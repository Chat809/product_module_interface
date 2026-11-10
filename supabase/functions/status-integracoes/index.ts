// Situação dos serviços externos para a tela Configurações > Integrações. Nunca devolve chaves ou segredos.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface Integracao { nome: string; ativa: boolean; detalhe: string }
interface Tarefa { nome: string; ativa: boolean; ultimoStatus: string | null }

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: permitido } = await comoUsuario.rpc('pode_acessar', { p_chave: 'configuracoes/integracoes' });
  if (permitido !== true) return resposta(403, { mensagem: 'Você não tem acesso às integrações' });

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: s, error } = await db.rpc('status_integracoes');

  let google = false;
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } });
    google = r.ok && (await r.json())?.external?.google === true;
  } catch {
    google = false;
  }
  const email = Deno.env.get('EMAIL_HABILITADO') === 'true';
  const tarefas = ((s?.tarefas ?? []) as Tarefa[]);
  const falhando = tarefas.filter((t) => t.ativa && t.ultimoStatus === 'failed').map((t) => t.nome);

  const lista: Integracao[] = [
    { nome: 'Supabase', ativa: !error, detalhe: error ? 'Não foi possível consultar o banco' : 'Banco, autenticação e arquivos conectados' },
    { nome: 'Login com Google', ativa: google, detalhe: google ? 'Provedor Google habilitado no Supabase' : 'Provedor Google desabilitado no Supabase' },
    { nome: 'E-mail', ativa: email, detalhe: email ? 'Envio de notificações por e-mail ligado' : 'Sem provedor de e-mail configurado; as notificações ficam só no painel' },
    {
      nome: 'Webhooks', ativa: (s?.webhooksSaidaAtivos ?? 0) + (s?.webhooksEntradaAtivos ?? 0) > 0,
      detalhe: `${s?.webhooksSaidaAtivos ?? 0} de saída e ${s?.webhooksEntradaAtivos ?? 0} de entrada ativos; `
        + `${s?.filaPendente ?? 0} evento(s) na fila e ${s?.falhas24h ?? 0} falha(s) nas últimas 24 h`,
    },
    {
      nome: 'Tarefas agendadas', ativa: tarefas.length > 0 && falhando.length === 0,
      detalhe: falhando.length ? `Com falha: ${falhando.join(', ')}` : `${tarefas.filter((t) => t.ativa).length} tarefa(s) ativas`,
    },
  ];
  return resposta(200, lista);
});
