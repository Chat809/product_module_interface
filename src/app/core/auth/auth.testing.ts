import { Papel, Usuario } from './auth.model';

/** Usuário fictício para testes. */
export function usuarioDeTeste(papel: Papel = 'USUARIO', acessos?: string[]): Usuario {
  return {
    id: 'u1',
    nome: 'Maria Souza',
    email: 'maria@exemplo.com',
    papel,
    acessos: acessos ?? (papel === 'ADMIN' ? ['*'] : ['dashboard', 'produtos']),
    criadoEm: null,
  };
}
