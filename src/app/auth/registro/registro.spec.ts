import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TimeoutError, of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { Registro } from './registro';

describe('Registro', () => {
  let fixture: ComponentFixture<Registro>;
  let component: Registro;
  let auth: { registrar: ReturnType<typeof vi.fn>; acordarApi: ReturnType<typeof vi.fn> };
  let notificacao: { sucesso: ReturnType<typeof vi.fn>; erro: ReturnType<typeof vi.fn> };
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    auth = { registrar: vi.fn(() => of({ nome: 'Maria Souza' })), acordarApi: vi.fn() };
    notificacao = { sucesso: vi.fn(), erro: vi.fn() };
    TestBed.configureTestingModule({
      imports: [Registro],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: Notificacao, useValue: notificacao },
      ],
    });
    fixture = TestBed.createComponent(Registro);
    component = fixture.componentInstance;
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fixture.whenStable();
  });

  function preencher(dados: Partial<Record<'nome' | 'email' | 'senha' | 'confirmacao', string>>): void {
    component['form'].setValue({
      nome: 'Maria',
      email: 'maria@exemplo.com',
      senha: 'segredo1',
      confirmacao: 'segredo1',
      ...dados,
    });
  }

  it('deve aplicar as mesmas regras da API', () => {
    preencher({ nome: ' ', email: 'x', senha: '123', confirmacao: '' });
    component['registrar']();

    expect(auth.registrar).not.toHaveBeenCalled();
    expect(component['mensagemDeErro']('nome')).toBe('O nome é obrigatório');
    expect(component['mensagemDeErro']('email')).toBe('Informe um e-mail válido');
    expect(component['mensagemDeErro']('senha')).toBe('A senha deve ter pelo menos 6 caracteres');
    expect(component['mensagemDeErro']('confirmacao')).toBe('Confirme a senha');
  });

  it('deve exigir que a confirmação seja igual à senha, revalidando ao mudar a senha', () => {
    preencher({ confirmacao: 'outra-senha' });
    expect(component['mensagemDeErro']('confirmacao')).toBe('As senhas não conferem');

    component['form'].controls.senha.setValue('outra-senha');
    expect(component['form'].controls.confirmacao.valid).toBe(true);
  });

  it('deve criar a conta e ir ao dashboard', () => {
    preencher({ nome: '  Maria Souza ' });
    component['registrar']();

    expect(auth.registrar).toHaveBeenCalledWith('Maria Souza', 'maria@exemplo.com', 'segredo1');
    expect(navegar).toHaveBeenCalledWith('/dashboard');
  });

  it('deve marcar o e-mail quando ele já estiver cadastrado', () => {
    auth.registrar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    preencher({});
    component['registrar']();

    expect(component['mensagemDeErro']('email')).toBe(
      'Já existe uma conta com este e-mail. Entre com ela ou use outro e-mail.',
    );
    expect(navegar).not.toHaveBeenCalled();
    expect(component['enviando']()).toBe(false);
  });

  it('deve liberar o e-mail duplicado assim que ele for alterado', () => {
    auth.registrar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    preencher({});
    component['registrar']();

    component['form'].controls.email.setValue('outro@exemplo.com');

    expect(component['form'].controls.email.valid).toBe(true);
  });

  it('deve acordar a API ao abrir a tela', () => {
    expect(auth.acordarApi).toHaveBeenCalled();
  });

  it('deve encerrar o carregamento e avisar quando a API não responder a tempo', () => {
    auth.registrar.mockReturnValue(throwError(() => new TimeoutError()));
    preencher({});
    component['registrar']();

    expect(notificacao.erro).toHaveBeenCalledWith(
      'A API demorou demais para responder. Tente novamente em instantes.',
    );
    expect(component['enviando']()).toBe(false);
  });

  it('deve exibir os erros por campo devolvidos pela API', () => {
    auth.registrar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { erros: [{ campo: 'senha', mensagem: 'Senha recusada' }] },
          }),
      ),
    );
    preencher({});
    component['registrar']();

    expect(component['mensagemDeErro']('senha')).toBe('Senha recusada');
  });
});
