// Páginas públicas do painel: /p/:token (formulário de lead, pesquisa, proposta, vaga) e /trabalhe-conosco.
// GET ?token=...  -> conteúdo do link
// POST { token, dados }            -> resposta ao link
// POST { vagaId, dados, curriculo } -> candidatura a vaga pública (currículo em PDF, base64, até 5 MB)
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const LIMITE_BYTES = 7 * 1024 * 1024;
const LIMITE_CURRICULO = 5 * 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MENSAGENS: Record<string, string> = {
  link_invalido: 'Este link expirou ou não está mais disponível',
  vaga_indisponivel: 'Esta vaga não está mais aberta',
  proposta_encerrada: 'Esta proposta já foi respondida',
  proposta_vencida: 'Esta proposta passou da validade',
  proposta_sem_cliente: 'Esta proposta ainda não pode ser aprovada. Fale com o responsável.',
  decisao_invalida: 'Escolha aprovar ou recusar',
};

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function texto(valor: unknown, min: number, max: number): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  return t.length >= min && t.length <= max ? t : null;
}

function validarPessoa(d: Record<string, unknown>): string | null {
  if (!texto(d.nome, 2, 150)) return 'Informe seu nome';
  if (typeof d.email !== 'string' || !EMAIL.test(d.email)) return 'Informe um e-mail válido';
  if (d.telefone != null && !texto(d.telefone, 0, 30)) return 'Telefone inválido';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('token') ?? '';
    if (!/^[a-f0-9]{64}$/.test(token)) return resposta(404, { mensagem: MENSAGENS.link_invalido });
    const { data } = await db.rpc('conteudo_link_publico', { p_token: token });
    return data ? resposta(200, data) : resposta(404, { mensagem: MENSAGENS.link_invalido });
  }
  if (req.method !== 'POST') return resposta(405, { mensagem: 'Método não permitido' });

  const bruto = await req.text();
  if (new TextEncoder().encode(bruto).length > LIMITE_BYTES) return resposta(413, { mensagem: 'Envio grande demais' });
  let corpo: Record<string, unknown>;
  try {
    corpo = JSON.parse(bruto);
  } catch {
    return resposta(400, { mensagem: 'Envio inválido' });
  }
  // Campo invisível no formulário: robôs costumam preenchê-lo.
  if (typeof corpo.site === 'string' && corpo.site.trim() !== '') return resposta(201, { id: null });
  const dados = (typeof corpo.dados === 'object' && corpo.dados !== null ? corpo.dados : {}) as Record<string, unknown>;

  async function guardarCurriculo(): Promise<string | null | Response> {
    const c = corpo.curriculo as { base64?: string } | undefined;
    if (!c?.base64) return null;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(c.base64), (ch) => ch.charCodeAt(0));
    } catch {
      return resposta(400, { mensagem: 'Currículo inválido' });
    }
    if (bytes.length > LIMITE_CURRICULO) return resposta(413, { mensagem: 'O currículo deve ter até 5 MB' });
    if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return resposta(400, { mensagem: 'Envie o currículo em PDF' });
    const caminho = `pessoas_candidatas/${crypto.randomUUID()}/curriculo.pdf`;
    const { error } = await db.storage.from('arquivos').upload(caminho, bytes, { contentType: 'application/pdf' });
    return error ? resposta(500, { mensagem: 'Não foi possível guardar o currículo' }) : caminho;
  }

  if (typeof corpo.vagaId === 'string') {
    if (!UUID.test(corpo.vagaId)) return resposta(404, { mensagem: MENSAGENS.vaga_indisponivel });
    const problema = validarPessoa(dados);
    if (problema) return resposta(400, { mensagem: problema });
    if (dados.consentimento !== true) return resposta(400, { mensagem: 'É preciso autorizar o uso dos seus dados para a seleção' });
    const { data: vaga } = await db.from('vagas_emprego').select('id').eq('id', corpo.vagaId)
      .eq('publica', true).eq('status', 'ABERTA').maybeSingle();
    if (!vaga) return resposta(404, { mensagem: MENSAGENS.vaga_indisponivel });
    const curriculo = await guardarCurriculo();
    if (curriculo instanceof Response) return curriculo;
    const { data, error } = await db.rpc('candidatar_em_vaga', { p_vaga: vaga.id, p_dados: dados, p_curriculo: curriculo });
    if (error) return resposta(400, { mensagem: MENSAGENS[error.message] ?? 'Não foi possível enviar sua candidatura' });
    return resposta(201, { id: data });
  }

  const token = typeof corpo.token === 'string' ? corpo.token : '';
  const { data: link } = await db.rpc('conteudo_link_publico', { p_token: token });
  if (!link) return resposta(404, { mensagem: MENSAGENS.link_invalido });

  if (link.tipo === 'FORMULARIO_LEAD') {
    if (!texto(dados.nome, 2, 150)) return resposta(400, { mensagem: 'Informe seu nome' });
    if (dados.email != null && dados.email !== '' && (typeof dados.email !== 'string' || !EMAIL.test(dados.email))) {
      return resposta(400, { mensagem: 'Informe um e-mail válido' });
    }
  } else if (link.tipo === 'PESQUISA_SATISFACAO') {
    if (!Number.isInteger(dados.nota) || (dados.nota as number) < 0 || (dados.nota as number) > 10) {
      return resposta(400, { mensagem: 'Escolha uma nota de 0 a 10' });
    }
  } else if (link.tipo === 'VAGA') {
    const problema = validarPessoa(dados);
    if (problema) return resposta(400, { mensagem: problema });
    if (dados.consentimento !== true) return resposta(400, { mensagem: 'É preciso autorizar o uso dos seus dados para a seleção' });
    const curriculo = await guardarCurriculo();
    if (curriculo instanceof Response) return curriculo;
    dados.curriculoCaminho = curriculo;
  }

  const { data, error } = await db.rpc('responder_link_publico', { p_token: token, p_dados: dados });
  if (error) return resposta(400, { mensagem: MENSAGENS[error.message] ?? 'Não foi possível enviar sua resposta' });
  return resposta(201, data);
});
