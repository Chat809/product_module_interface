import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { sessaoDeTeste } from './core/auth/auth.testing';

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

  it('com sessão, a raiz deve abrir o primeiro módulo liberado e bloquear os demais', async () => {
    localStorage.setItem('painel.sessao', JSON.stringify(sessaoDeTeste('USUARIO', 'acesso', ['produtos'])));
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/produtos');

    await harness.navigateByUrl('/usuarios');
    expect(TestBed.inject(Router).url).toBe('/produtos');
  });

  it('sem nenhum módulo deve cair na tela de sem acesso', async () => {
    localStorage.setItem('painel.sessao', JSON.stringify(sessaoDeTeste('USUARIO', 'acesso', [])));
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/dashboard');

    expect(TestBed.inject(Router).url).toBe('/sem-acesso');
    expect(harness.routeNativeElement?.textContent).toContain('Nenhum módulo liberado');
  });

  it('financeiro exige o módulo; Meu perfil abre para qualquer conta', async () => {
    localStorage.setItem('painel.sessao', JSON.stringify(sessaoDeTeste('USUARIO', 'acesso', ['demandas'])));
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/financeiro');
    expect(TestBed.inject(Router).url).toBe('/demandas');

    await harness.navigateByUrl('/perfil');
    expect(TestBed.inject(Router).url).toBe('/perfil');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Meu perfil');
  });

  it('deve permitir abrir a tela de registro sem sessão', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/registro');

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Criar conta');
  });
});
