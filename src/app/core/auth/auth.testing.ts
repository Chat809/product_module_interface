import { Papel, Sessao } from './auth.model';

/** Sessão fictícia usada pelos testes. */
export function sessaoDeTeste(papel: Papel = 'USUARIO', token = 'acesso', acessos?: string[]): Sessao {
  return {
    accessToken: token,
    refreshToken: `renovacao-${token}`,
    expiraEm: '2026-11-03T13:00:00Z',
    usuario: {
      id: 'u1',
      nome: 'Maria Souza',
      email: 'maria@exemplo.com',
      papel,
      acessos: acessos ?? (papel === 'ADMIN' ? ['*'] : ['dashboard', 'produtos']),
      criadoEm: null,
    },
  };
}
