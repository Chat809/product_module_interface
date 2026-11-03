import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

describe('App (rotas)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())));
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sem sessão deve abrir o login, guardando a rota pedida', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/produtos');

    expect(TestBed.inject(Router).url).toBe('/login?voltar=%2Fprodutos');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Entrar');
  });

  it('deve permitir abrir a tela de registro sem sessão', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/registro');

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Criar conta');
  });
});
