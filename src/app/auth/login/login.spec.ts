import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let auth: { entrar: ReturnType<typeof vi.fn> };
  let notificacao: { sucesso: ReturnType<typeof vi.fn> };
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    auth = { entrar: vi.fn(() => of({ nome: 'Maria Souza' })) };
    notificacao = { sucesso: vi.fn() };
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: Notificacao, useValue: notificacao },
      ],
    });
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fixture.whenStable();
  });

  function preencher(email: string, senha: string): void {
    component['form'].setValue({ email, senha });
  }

  it('não deve chamar a API com o formulário inválido', () => {
    preencher('nao-e-email', '');
    component['entrar']();
    expect(auth.entrar).not.toHaveBeenCalled();
    expect(component['form'].controls.email.touched).toBe(true);
  });

  it('deve entrar, cumprimentar pelo primeiro nome e ir ao dashboard', () => {
    preencher('maria@exemplo.com', 'segredo1');
    component['entrar']();

    expect(auth.entrar).toHaveBeenCalledWith('maria@exemplo.com', 'segredo1');
    expect(notificacao.sucesso).toHaveBeenCalledWith('Olá, Maria!');
    expect(navegar).toHaveBeenCalledWith('/dashboard');
  });

  it('deve voltar para a rota pedida antes do login', () => {
    fixture.componentRef.setInput('voltar', '/produtos');
    preencher('maria@exemplo.com', 'segredo1');
    component['entrar']();
    expect(navegar).toHaveBeenCalledWith('/produtos');
  });

  it('deve limpar a senha quando o login falhar', () => {
    auth.entrar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    preencher('maria@exemplo.com', 'errada');
    component['entrar']();

    expect(component['form'].controls.senha.value).toBe('');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('deve ter link para criar conta', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector('a[href="/registro"]');
    expect(link?.textContent).toContain('Criar conta');
  });
});
