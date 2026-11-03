import { Modulo, Usuario } from './auth.model';

export const ACESSO_TOTAL = '*';

/** Contas novas e sessões salvas antes da coluna `acessos` existir recebem este padrão, como na API. */
export const ACESSOS_PADRAO: Modulo[] = ['dashboard', 'produtos', 'demandas'];

export interface DefinicaoDeModulo {
  chave: Modulo;
  rotulo: string;
  icone: string;
  rota: string;
  somenteAdmin: boolean;
}

/** Na mesma ordem do menu e do enum Modulo da API. */
export const MODULOS: DefinicaoDeModulo[] = [
  { chave: 'dashboard', rotulo: 'Dashboard', icone: 'dashboard', rota: '/dashboard', somenteAdmin: false },
  { chave: 'produtos', rotulo: 'Produtos', icone: 'inventory_2', rota: '/produtos', somenteAdmin: false },
  { chave: 'demandas', rotulo: 'Demandas', icone: 'view_kanban', rota: '/demandas', somenteAdmin: false },
  { chave: 'financeiro', rotulo: 'Financeiro', icone: 'payments', rota: '/financeiro', somenteAdmin: false },
  { chave: 'usuarios', rotulo: 'Usuários', icone: 'group', rota: '/usuarios', somenteAdmin: true },
];

/**
 * Mesma regra de `Acessos.liberados` da API: administradores acessam tudo; para os demais, `'*'` libera
 * todos os módulos exceto o de usuários. A API é quem decide de fato: isto só monta menu e rotas.
 */
export function podeAcessar(usuario: Usuario | null, modulo: Modulo): boolean {
  if (!usuario) {
    return false;
  }
  if (usuario.papel === 'ADMIN') {
    return true;
  }
  if (modulo === 'usuarios') {
    return false;
  }
  const acessos = usuario.acessos ?? ACESSOS_PADRAO;
  return acessos.includes(ACESSO_TOTAL) || acessos.includes(modulo);
}

/** Texto curto para exibir os acessos de alguém, por exemplo "Dashboard, Produtos". */
export function descreverAcessos(usuario: Usuario): string {
  if (usuario.papel === 'ADMIN' || usuario.acessos.includes(ACESSO_TOTAL)) {
    return 'Acesso total';
  }
  const rotulos = MODULOS.filter((m) => usuario.acessos.includes(m.chave)).map((m) => m.rotulo);
  return rotulos.length ? rotulos.join(', ') : 'Nenhum módulo';
}
