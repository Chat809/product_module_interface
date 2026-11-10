// Recebe leads de outros sistemas: POST /functions/v1/webhooks-entrada/{token} (ou ?token=) com JSON até 16 KB.
// Token desconhecido ou inativo responde 404 sem detalhes.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const LIMITE_BYTES = 16 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta(405, { mensagem: 'Método não permitido' });

  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? url.pathname.split('/').filter(Boolean).pop() ?? '';
  const bruto = await req.text();
  if (new TextEncoder().encode(bruto).length > LIMITE_BYTES) return resposta(413, { mensagem: 'Conteúdo maior que 16 KB' });

  let dados: Record<string, unknown>;
  try {
    dados = JSON.parse(bruto);
  } catch {
    return resposta(400, { mensagem: 'Envie um JSON válido' });
  }
  if (typeof dados !== 'object' || dados === null || Array.isArray(dados)) return resposta(400, { mensagem: 'Envie um objeto JSON' });

  const nome = typeof dados.nome === 'string' ? dados.nome.trim() : '';
  if (nome.length < 2 || nome.length > 150) return resposta(400, { mensagem: 'O nome deve ter entre 2 e 150 caracteres' });
  if (dados.email != null && (typeof dados.email !== 'string' || !EMAIL.test(dados.email))) {
    return resposta(400, { mensagem: 'Informe um e-mail válido' });
  }
  if (dados.valorEstimado != null && !(typeof dados.valorEstimado === 'number' && dados.valorEstimado >= 0 && dados.valorEstimado < 1e10)) {
    return resposta(400, { mensagem: 'Valor estimado inválido' });
  }

  const utmDaUrl = Object.fromEntries(UTM.map((k) => [k, url.searchParams.get(k)]).filter(([, v]) => v));
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: id, error } = await db.rpc('receber_lead_webhook', { p_token: token, p_dados: { ...utmDaUrl, ...dados, nome } });
  if (error) return resposta(400, { mensagem: 'Não foi possível registrar o lead' });
  if (!id) return resposta(404, { mensagem: 'Endereço de integração não encontrado' });
  return resposta(201, { id });
});
