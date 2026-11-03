import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { sessaoDeTeste } from './auth.testing';

describe('AuthService', () => {
  const url = `${environment.apiUrl}/auth`;
  let controle: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };

  function criar(): AuthService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    controle = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    localStorage.clear();
    router = { navigate: vi.fn() };
  });

  afterEach(() => controle.verify());

  it('deve começar deslogado quando não houver sessão guardada', () => {
    const auth = criar();
    expect(auth.logado()).toBe(false);
    expect(auth.token()).toBeNull();
  });

  it('deve entrar, guardar a sessão e expor o usuário e o papel', () => {
    const auth = criar();
    let nome = '';
    auth.entrar('maria@exemplo.com', 'segredo1').subscribe((usuario) => (nome = usuario.nome));

    const req = controle.expectOne(`${url}/login`);
    expect(req.request.body).toEqual({ email: 'maria@exemplo.com', senha: 'segredo1' });
    req.flush(sessaoDeTeste('ADMIN'));

    expect(nome).toBe('Maria Souza');
    expect(auth.logado()).toBe(true);
    expect(auth.ehAdmin()).toBe(true);
    expect(auth.token()).toBe('acesso');
    expect(JSON.parse(localStorage.getItem('painel.sessao')!).accessToken).toBe('acesso');
  });

  it('deve restaurar a sessão guardada ao recarregar a página', () => {
    localStorage.setItem('painel.sessao', JSON.stringify(sessaoDeTeste()));
    const auth = criar();
    expect(auth.usuario()?.email).toBe('maria@exemplo.com');
    expect(auth.ehAdmin()).toBe(false);
  });

  it('deve ignorar uma sessão guardada corrompida', () => {
    localStorage.setItem('painel.sessao', '{nao-e-json');
    expect(criar().logado()).toBe(false);
  });

  it('deve registrar já abrindo a sessão', () => {
    const auth = criar();
    auth.registrar('Maria', 'maria@exemplo.com', 'segredo1').subscribe();

    const req = controle.expectOne(`${url}/registro`);
    expect(req.request.body).toEqual({ nome: 'Maria', email: 'maria@exemplo.com', senha: 'segredo1' });
    req.flush(sessaoDeTeste());

    expect(auth.logado()).toBe(true);
  });

  it('deve compartilhar uma única renovação entre chamadas simultâneas', () => {
    localStorage.setItem('painel.sessao', JSON.stringify(sessaoDeTeste()));
    const auth = criar();
    const tokens: string[] = [];
    auth.renovar().subscribe((s) => tokens.push(s.accessToken));
    auth.renovar().subscribe((s) => tokens.push(s.accessToken));

    const req = controle.expectOne(`${url}/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'renovacao-acesso' });
    req.flush(sessaoDeTeste('USUARIO', 'novo'));

    expect(tokens).toEqual(['novo', 'novo']);
    expect(auth.token()).toBe('novo');
  });

  it('deve acordar a API uma única vez, sem passar pelos interceptors', () => {
    const fetch = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal('fetch', fetch);
    const auth = criar();

    auth.acordarApi();
    auth.acordarApi();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(`${new URL(environment.apiUrl).origin}/actuator/health`, {
      mode: 'no-cors',
      cache: 'no-store',
    });
    vi.unstubAllGlobals();
  });

  it('deve sair limpando a sessão e voltar ao login', () => {
    localStorage.setItem('painel.sessao', JSON.stringify(sessaoDeTeste()));
    const auth = criar();

    auth.sair();

    expect(auth.logado()).toBe(false);
    expect(localStorage.getItem('painel.sessao')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
