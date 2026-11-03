import { descreverAcessos, podeAcessar } from './acessos';
import { Usuario } from './auth.model';

function usuario(papel: Usuario['papel'], acessos: string[]): Usuario {
  return { id: 'u1', nome: 'Maria', email: 'maria@exemplo.com', papel, acessos, criadoEm: null };
}

describe('acessos', () => {
  it('administrador acessa todos os módulos, mesmo com a lista limitada', () => {
    const admin = usuario('ADMIN', ['dashboard']);
    expect(podeAcessar(admin, 'produtos')).toBe(true);
    expect(podeAcessar(admin, 'usuarios')).toBe(true);
  });

  it('usuário acessa só os módulos da lista', () => {
    const maria = usuario('USUARIO', ['dashboard']);
    expect(podeAcessar(maria, 'dashboard')).toBe(true);
    expect(podeAcessar(maria, 'produtos')).toBe(false);
  });

  it("'*' libera tudo para o usuário, exceto o módulo de usuários", () => {
    const maria = usuario('USUARIO', ['*', 'usuarios']);
    expect(podeAcessar(maria, 'produtos')).toBe(true);
    expect(podeAcessar(maria, 'usuarios')).toBe(false);
  });

  it('sessão salva antes dos acessos existirem recebe o padrão; sem sessão, nada', () => {
    const antigo = { ...usuario('USUARIO', []), acessos: undefined } as unknown as Usuario;
    expect(podeAcessar(antigo, 'dashboard')).toBe(true);
    expect(podeAcessar(antigo, 'produtos')).toBe(true);
    expect(podeAcessar(antigo, 'demandas')).toBe(true);
    expect(podeAcessar(antigo, 'financeiro')).toBe(false);
    expect(podeAcessar(null, 'dashboard')).toBe(false);
  });

  it('deve descrever os acessos em texto', () => {
    expect(descreverAcessos(usuario('ADMIN', ['*']))).toBe('Acesso total');
    expect(descreverAcessos(usuario('USUARIO', ['*']))).toBe('Acesso total');
    expect(descreverAcessos(usuario('USUARIO', ['produtos', 'dashboard']))).toBe('Dashboard, Produtos');
    expect(descreverAcessos(usuario('USUARIO', ['financeiro', 'demandas']))).toBe('Demandas, Financeiro');
    expect(descreverAcessos(usuario('USUARIO', []))).toBe('Nenhum módulo');
  });
});
