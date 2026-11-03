import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { adminGuard, authGuard, visitanteGuard } from './auth.guards';
import { AuthService } from './auth.service';

describe('guards de autenticação', () => {
  const auth = { logado: vi.fn(), ehAdmin: vi.fn() };
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

  it('adminGuard deve liberar admin e mandar os demais ao dashboard', () => {
    auth.ehAdmin.mockReturnValue(true);
    expect(executar(adminGuard)).toBe(true);

    auth.ehAdmin.mockReturnValue(false);
    expect(destino(executar(adminGuard))).toBe('/dashboard');
  });

  it('visitanteGuard deve tirar do login quem já entrou', () => {
    auth.logado.mockReturnValue(false);
    expect(executar(visitanteGuard)).toBe(true);

    auth.logado.mockReturnValue(true);
    expect(destino(executar(visitanteGuard))).toBe('/dashboard');
  });
});
