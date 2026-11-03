import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard, moduloGuard, visitanteGuard } from './auth.guards';
import { AuthService } from './auth.service';

describe('guards de autenticação', () => {
  const auth = { logado: vi.fn(), podeAcessar: vi.fn(), rotaInicial: vi.fn(() => '/dashboard') };
  const rota = {} as ActivatedRouteSnapshot;

  function executar(guard: typeof authGuard, url = '/produtos'): boolean | UrlTree {
    return TestBed.runInInjectionContext(() => guard(rota, { url } as RouterStateSnapshot)) as boolean | UrlTree;
  }

  function destino(resultado: boolean | UrlTree): string {
    return (resultado as UrlTree).toString();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  it('authGuard deve liberar quem está logado', () => {
    auth.logado.mockReturnValue(true);
    expect(executar(authGuard)).toBe(true);
  });

  it('authGuard deve mandar para o login guardando a rota pedida', () => {
    auth.logado.mockReturnValue(false);
    expect(destino(executar(authGuard, '/produtos'))).toBe('/login?voltar=%2Fprodutos');
  });

  it('moduloGuard deve liberar quem tem o módulo', () => {
    auth.podeAcessar.mockReturnValue(true);
    expect(executar(moduloGuard('produtos'))).toBe(true);
    expect(auth.podeAcessar).toHaveBeenCalledWith('produtos');
  });

  it('moduloGuard deve mandar os demais para o primeiro módulo liberado', () => {
    auth.podeAcessar.mockReturnValue(false);
    auth.rotaInicial.mockReturnValue('/produtos');
    expect(destino(executar(moduloGuard('usuarios')))).toBe('/produtos');

    auth.rotaInicial.mockReturnValue('/sem-acesso');
    expect(destino(executar(moduloGuard('dashboard')))).toBe('/sem-acesso');
  });

  it('visitanteGuard deve tirar do login quem já entrou', () => {
    auth.logado.mockReturnValue(false);
    expect(executar(visitanteGuard)).toBe(true);

    auth.logado.mockReturnValue(true);
    auth.rotaInicial.mockReturnValue('/dashboard');
    expect(destino(executar(visitanteGuard))).toBe('/dashboard');
  });
});
