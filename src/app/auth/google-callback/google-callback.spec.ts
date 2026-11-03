import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TimeoutError, of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { GoogleCallback } from './google-callback';

describe('GoogleCallback', () => {
  let auth: {
    concluirGoogle: ReturnType<typeof vi.fn>;
    acordarApi: ReturnType<typeof vi.fn>;
    rotaInicial: ReturnType<typeof vi.fn>;
  };
  let notificacao: { sucesso: ReturnType<typeof vi.fn>; erro: ReturnType<typeof vi.fn> };
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    auth = {
      concluirGoogle: vi.fn(() => of({ usuario: { nome: 'Maria Souza' } })),
      acordarApi: vi.fn(),
      rotaInicial: vi.fn(() => '/produtos'),
    };
    notificacao = { sucesso: vi.fn(), erro: vi.fn() };
    TestBed.configureTestingModule({
      imports: [GoogleCallback],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: Notificacao, useValue: notificacao },
      ],
    });
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  function abrir(parametros: Record<string, string>): void {
    const fixture = TestBed.createComponent(GoogleCallback);
    Object.entries(parametros).forEach(([nome, valor]) => fixture.componentRef.setInput(nome, valor));
    fixture.detectChanges();
  }

  it('deve trocar o código, cumprimentar e ir ao primeiro módulo liberado', () => {
    abrir({ code: 'codigo-google' });

    expect(auth.concluirGoogle).toHaveBeenCalledWith('codigo-google');
    expect(notificacao.sucesso).toHaveBeenCalledWith('Olá, Maria!');
    expect(navegar).toHaveBeenCalledWith('/produtos', { replaceUrl: true });
  });

  it('deve voltar à rota pedida antes do login', () => {
    auth.concluirGoogle.mockReturnValue(of({ usuario: { nome: 'Maria' }, voltar: '/usuarios' }));
    abrir({ code: 'codigo-google' });
    expect(navegar).toHaveBeenCalledWith('/usuarios', { replaceUrl: true });
  });

  it('deve avisar quando a pessoa cancelar no Google', () => {
    abrir({ error: 'access_denied', error_description: 'The user denied access' });

    expect(notificacao.erro).toHaveBeenCalledWith('Login com Google cancelado.');
    expect(auth.concluirGoogle).not.toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('deve mostrar a descrição de outros erros do provedor', () => {
    abrir({ error: 'server_error', error_description: 'Unable to exchange external code' });
    expect(notificacao.erro).toHaveBeenCalledWith(
      'Não foi possível entrar com Google: Unable to exchange external code',
    );
  });

  it('deve voltar ao login quando o retorno vier sem código', () => {
    abrir({});
    expect(notificacao.erro).toHaveBeenCalledWith('Retorno do Google sem código de autorização. Tente novamente.');
    expect(navegar).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('deve deixar a mensagem da API para o interceptor quando o código for recusado', () => {
    auth.concluirGoogle.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    abrir({ code: 'usado' });

    expect(notificacao.erro).not.toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('deve avisar quando a API não responder a tempo', () => {
    auth.concluirGoogle.mockReturnValue(throwError(() => new TimeoutError()));
    abrir({ code: 'codigo-google' });
    expect(notificacao.erro).toHaveBeenCalledWith('A API demorou demais para responder. Tente novamente em instantes.');
  });

  it('deve avisar quando o login foi iniciado em outra aba', () => {
    auth.concluirGoogle.mockReturnValue(throwError(() => new Error('Login com Google não iniciado nesta aba')));
    abrir({ code: 'codigo-google' });
    expect(notificacao.erro).toHaveBeenCalledWith(
      'O login com Google foi iniciado em outra aba ou expirou. Tente novamente.',
    );
  });
});
