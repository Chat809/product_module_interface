// Entrega os eventos da fila_eventos aos webhooks de saída, assinando cada envio com HMAC-SHA256.
// Acionada pelo pg_cron (cabeçalho x-fila-token) ou pelo painel para testar um destino ({ acao: 'testar' }).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ESPERAS_MIN = [1, 5, 30];
const LIMITE_TENTATIVAS = 3;
const TEMPO_LIMITE_MS = 10_000;

interface Destino { id: string; url: string; segredo: string; eventos: string[] }
interface Evento { id: number; evento: string; payload: unknown; tentativas: number; entregues: string[]; criado_em: string }

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function ipPrivado(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(':')) return h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:');
  return false;
}

async function enderecoPublico(url: string): Promise<boolean> {
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    return false;
  }
  if (alvo.protocol !== 'https:' || ipPrivado(alvo.hostname)) return false;
  try {
    const ips = [
      ...(await Deno.resolveDns(alvo.hostname, 'A').catch(() => [] as string[])),
      ...(await Deno.resolveDns(alvo.hostname, 'AAAA').catch(() => [] as string[])),
    ];
    return ips.every((ip) => !ipPrivado(ip));
  } catch {
    return true;
  }
}

async function assinar(segredo: string, corpo: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)));
  return 'sha256=' + Array.from(assinatura, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function entregar(db: SupabaseClient, destino: Destino, evento: string, dados: unknown, ocorridoEm: string, tentativa: number) {
  const corpo = JSON.stringify({ evento, ocorridoEm, dados });
  const inicio = Date.now();
  let status: number | null = null;
  let erro: string | null = null;
  if (!(await enderecoPublico(destino.url))) {
    erro = 'Endereço não permitido (precisa ser HTTPS público)';
  } else {
    try {
      const r = await fetch(destino.url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TriboRaizes-Webhooks/1.0',
          'X-Tribo-Evento': evento,
          'X-Tribo-Assinatura': await assinar(destino.segredo, corpo),
        },
        body: corpo,
      });
      status = r.status;
      await r.body?.cancel();
      if (status < 200 || status >= 300) erro = `Resposta HTTP ${status}`;
    } catch (e) {
      erro = e instanceof Error && e.name === 'TimeoutError' ? 'Tempo esgotado' : 'Falha de conexão';
    }
  }
  const sucesso = erro === null;
  await db.from('webhook_entregas').insert({
    webhook_id: destino.id, evento, payload: { evento, ocorridoEm, dados }, status_http: status, sucesso,
    tentativas: tentativa, erro, duracao_ms: Date.now() - inicio,
  });
  return sucesso;
}

async function processarFila(db: SupabaseClient) {
  const { data: eventos, error } = await db.rpc('reservar_eventos', { p_limite: 20 });
  if (error) return resposta(500, { mensagem: 'Falha ao ler a fila' });
  const { data: destinos } = await db.from('webhooks_saida').select('id, url, segredo, eventos').eq('ativo', true);
  let entregues = 0;
  for (const ev of (eventos ?? []) as Evento[]) {
    const alvos = ((destinos ?? []) as Destino[]).filter((d) => d.eventos.includes(ev.evento) && !ev.entregues.includes(d.id));
    const ok: string[] = [...ev.entregues];
    for (const d of alvos) {
      if (await entregar(db, d, ev.evento, ev.payload, ev.criado_em, ev.tentativas)) {
        ok.push(d.id);
        entregues++;
      }
    }
    const pendentes = alvos.filter((d) => !ok.includes(d.id)).length;
    const encerrar = pendentes === 0 || ev.tentativas >= LIMITE_TENTATIVAS;
    await db.from('fila_eventos').update({
      entregues: ok,
      processado_em: encerrar ? new Date().toISOString() : null,
      erro: pendentes === 0 ? null : `${pendentes} destino(s) sem sucesso`,
      proxima_tentativa_em: new Date(Date.now() + ESPERAS_MIN[Math.min(ev.tentativas, ESPERAS_MIN.length) - 1] * 60_000).toISOString(),
    }).eq('id', ev.id);
  }
  return resposta(200, { eventos: (eventos ?? []).length, entregues });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta(405, { mensagem: 'Método não permitido' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const tokenFila = req.headers.get('x-fila-token');
  if (tokenFila) {
    const { data: esperado } = await db.rpc('token_da_fila');
    if (!esperado || tokenFila !== esperado) return resposta(401, { mensagem: 'Não autorizado' });
    return processarFila(db);
  }

  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: permitido } = await comoUsuario.rpc('pode_acessar', { p_chave: 'configuracoes/webhooks' });
  if (permitido !== true) return resposta(403, { mensagem: 'Você não tem acesso aos webhooks' });

  const corpo = await req.json().catch(() => ({}));
  if (corpo.acao !== 'testar' || typeof corpo.webhookId !== 'string') return resposta(400, { mensagem: 'Ação desconhecida' });
  const { data: destino } = await db.from('webhooks_saida').select('id, url, segredo, eventos').eq('id', corpo.webhookId).maybeSingle();
  if (!destino) return resposta(404, { mensagem: 'Webhook não encontrado' });
  const sucesso = await entregar(db, destino as Destino, 'teste.ping', { mensagem: 'Teste de entrega do painel' }, new Date().toISOString(), 1);
  return resposta(200, { sucesso });
});
