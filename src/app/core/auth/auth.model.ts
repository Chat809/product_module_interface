export type Papel = 'ADMIN' | 'USUARIO';

/** Módulos do painel, com as mesmas chaves gravadas na coluna `acessos` do perfil. */
export type Modulo = 'dashboard' | 'produtos' | 'demandas' | 'financeiro' | 'usuarios';

/** Espelha o UsuarioDTO da API. `acessos` traz `'*'` (todos) ou as chaves dos módulos liberados. */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  acessos: string[];
  criadoEm: string | null;
  /** Ausente na resposta do login; vem de `/usuarios/me` e da listagem de usuários. */
  avatarUrl?: string | null;
  /** Departamento e cargo (`funcao`) na empresa, definidos pelo admin; ausentes na resposta do login. */
  departamento?: string | null;
  funcao?: string | null;
}

/** Espelha o SessaoDTO da API. */
export interface Sessao {
  accessToken: string;
  refreshToken: string;
  expiraEm: string;
  usuario: Usuario;
}
