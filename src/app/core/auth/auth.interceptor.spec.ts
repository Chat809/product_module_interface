import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { sessaoDeTeste } from './auth.testing';

describe('authInterceptor', () => {
  const produtos = `${environment.apiUrl}/produtos`;
  let http: HttpClient;
  let controle: HttpTestingController;
  let auth: {
    token: ReturnType<typeof vi.fn>;
    renovar: ReturnType<typeof vi.fn>;
    sair: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    auth = {
      token: vi.fn(() => 'acesso'),
      renovar: vi.fn(() => of(sessaoDeTeste('USUARIO', 'novo'))),
      sair: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  it('deve enviar o token nas chamadas à API', () => {
    http.get(produtos).subscribe();
    const req = controle.expectOne(produtos);
    expect(req.request.headers.get('Authorization')).toBe('Bearer acesso');
    req.flush([]);
  });

  it('não deve enviar o token para as rotas de autenticação nem para outros domínios', () => {
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe();
    http.get('https://outro.site/dados').subscribe();

    expect(controle.expectOne(`${environment.apiUrl}/auth/login`).request.headers.has('Authorization')).toBe(false);
    expect(controle.expectOne('https://outro.site/dados').request.headers.has('Authorization')).toBe(false);
  });

  it('não deve mexer na requisição sem sessão', () => {
    auth.token.mockReturnValue(null);
    http.get(produtos).subscribe();
    expect(controle.expectOne(produtos).request.headers.has('Authorization')).toBe(false);
  });

  it('em 401 deve renovar a sessão e repetir a requisição com o novo token', () => {
    let resposta: unknown;
    http.get(produtos).subscribe((r) => (resposta = r));

    controle.expectOne(produtos).flush(null, { status: 401, statusText: 'Unauthorized' });
    const repetida = controle.expectOne(produtos);
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer novo');
    repetida.flush(['ok']);

    expect(auth.renovar).toHaveBeenCalledTimes(1);
    expect(resposta).toEqual(['ok']);
  });

  it('se a renovação falhar deve encerrar a sessão e repassar o 401', () => {
    auth.renovar.mockReturnValue(throwError(() => new Error('refresh inválido')));
    let status = 0;
    http.get(produtos).subscribe({ error: (e) => (status = e.status) });

    controle.expectOne(produtos).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.sair).toHaveBeenCalled();
    expect(status).toBe(401);
  });

  it('não deve tentar renovar em outros erros', () => {
    http.get(produtos).subscribe({ error: () => undefined });
    controle.expectOne(produtos).flush(null, { status: 403, statusText: 'Forbidden' });
    expect(auth.renovar).not.toHaveBeenCalled();
  });
});
