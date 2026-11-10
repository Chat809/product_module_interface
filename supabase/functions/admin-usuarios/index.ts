// Operações de usuário que exigem a chave do servidor (criar, alterar e-mail/papel, senha, excluir).
// Só quem tem a subaba configuracoes/usuarios chega aqui; o RLS continua valendo para o resto.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PAPEIS = ['ADMIN', 'USUARIO'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function erro(status: number, mensagem: string) {
  return resposta(status, { mensagem });
}

function texto(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim();
  return limpo ? limpo.slice(0, max) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return erro(405, 'Método não permitido');

  const url = Deno.env.get('SUPABASE_URL')!;
  const autorizacao = req.headers.get('Authorization') ?? '';
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false },
  });
  const { data: sessao } = await comoUsuario.auth.getUser();
  if (!sessao?.user) return erro(401, 'Sessão expirada. Entre novamente.');
  const { data: permitido } = await comoUsuario.rpc('pode_acessar', { p_chave: 'configuracoes/usuarios' });
  if (permitido !== true) return erro(403, 'Você não tem acesso à gestão de usuários');

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return erro(400, 'Corpo inválido');
  }
  const acao = corpo.acao;
  const id = typeof corpo.id === 'string' && UUID.test(corpo.id) ? corpo.id : null;

  const perfil: Record<string, unknown> = {};
  const nome = texto(corpo.nome, 100);
  if (nome) perfil.nome = nome;
  if (typeof corpo.papel === 'string') {
    if (!PAPEIS.includes(corpo.papel)) return erro(400, 'Papel inválido');
    perfil.papel = corpo.papel;
  }
  if (Array.isArray(corpo.acessos)) perfil.acessos = corpo.acessos.filter((a) => typeof a === 'string');
  if ('departamento' in corpo) perfil.departamento = texto(corpo.departamento, 60);
  if ('funcao' in corpo) perfil.funcao = texto(corpo.funcao, 80);
  if ('telefone' in corpo) perfil.telefone = texto(corpo.telefone, 30);

  const email = texto(corpo.email, 254)?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) return erro(400, 'Informe um e-mail válido');
  const senha = typeof corpo.senha === 'string' ? corpo.senha : null;
  if (senha !== null && (senha.length < 6 || senha.length > 72)) return erro(400, 'A senha deve ter entre 6 e 72 caracteres');

  async function restaAlgumAdmin(semId: string) {
    const { count } = await admin.from('perfis').select('id', { count: 'exact', head: true })
      .eq('papel', 'ADMIN').neq('id', semId);
    return (count ?? 0) > 0;
  }

  async function salvarPerfil(usuarioId: string) {
    if (Object.keys(perfil).length === 0) return null;
    const { error } = await admin.from('perfis').update(perfil).eq('id', usuarioId);
    return error;
  }

  if (acao === 'criar') {
    if (!email || !nome) return erro(400, 'Nome e e-mail são obrigatórios');
    if (!senha) return erro(400, 'Defina uma senha inicial');
    const { data, error } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true, user_metadata: { nome },
    });
    if (error) {
      return erro(error.message.toLowerCase().includes('already') ? 409 : 400,
        error.message.toLowerCase().includes('already') ? 'Já existe um usuário com este e-mail' : 'Não foi possível criar o usuário');
    }
    const falha = await salvarPerfil(data.user.id);
    if (falha) return erro(400, 'Usuário criado, mas os acessos não foram salvos: ' + falha.message);
    return resposta(201, { id: data.user.id });
  }

  if (!id) return erro(400, 'Usuário não informado');

  if (acao === 'atualizar') {
    if (id === sessao.user.id && perfil.papel === 'USUARIO') return erro(400, 'Você não pode remover o seu próprio papel de administrador');
    if (perfil.papel === 'USUARIO' && !(await restaAlgumAdmin(id))) return erro(400, 'O sistema precisa de pelo menos um administrador');
    if (email) {
      const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
      if (error) {
        return error.message.toLowerCase().includes('already')
          ? erro(409, 'Este e-mail já pertence a outra conta')
          : erro(400, 'Não foi possível alterar o e-mail');
      }
      perfil.email = email;
    }
    const falha = await salvarPerfil(id);
    if (falha) return erro(400, falha.message);
    return resposta(200, { id });
  }

  if (acao === 'redefinir_senha') {
    if (!senha) return erro(400, 'Informe a nova senha');
    const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
    if (error) return erro(400, 'Não foi possível alterar a senha');
    return resposta(200, { id });
  }

  if (acao === 'excluir') {
    if (id === sessao.user.id) return erro(400, 'Você não pode excluir a sua própria conta');
    if (!(await restaAlgumAdmin(id))) return erro(400, 'O sistema precisa de pelo menos um administrador');
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return erro(400, 'Não foi possível excluir o usuário');
    return resposta(200, { id });
  }

  return erro(400, 'Ação desconhecida');
});
