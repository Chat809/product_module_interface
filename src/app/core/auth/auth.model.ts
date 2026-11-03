export type Papel = 'ADMIN' | 'USUARIO';

/** Espelha o UsuarioDTO da API. */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  criadoEm: string | null;
}

/** Espelha o SessaoDTO da API. */
export interface Sessao {
  accessToken: string;
  refreshToken: string;
  expiraEm: string;
  usuario: Usuario;
}
