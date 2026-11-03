import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { Usuario } from '../../core/auth/auth.model';
import { UsuarioService } from '../usuario.service';
import { SenhaDialog } from './senha-dialog';

describe('SenhaDialog', () => {
  const maria: Usuario = {
    id: 'maria',
    nome: 'Maria',
    email: 'maria@exemplo.com',
    papel: 'USUARIO',
    acessos: ['dashboard'],
    criadoEm: null,
  };

  let fixture: ComponentFixture<SenhaDialog>;
  let component: SenhaDialog;
  let service: { redefinirSenha: ReturnType<typeof vi.fn> };
  let fechar: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    service = { redefinirSenha: vi.fn(() => of(undefined)) };
    fechar = vi.fn();
    TestBed.configureTestingModule({
      imports: [SenhaDialog],
      providers: [
        { provide: UsuarioService, useValue: service },
        { provide: MatDialogRef, useValue: { close: fechar } },
        { provide: MAT_DIALOG_DATA, useValue: maria },
      ],
    });
    fixture = TestBed.createComponent(SenhaDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('deve explicar que a senha atual não pode ser consultada', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('não pode ser consultada');
  });

  it('deve exigir senha válida e confirmação igual', () => {
    component['form'].setValue({ senha: '123', confirmacao: '' });
    component['salvar']();
    expect(service.redefinirSenha).not.toHaveBeenCalled();
    expect(component['mensagemDaSenha']()).toBe('A senha deve ter pelo menos 6 caracteres');

    component['form'].setValue({ senha: 'novaSenha1', confirmacao: 'outra' });
    expect(component['form'].controls.confirmacao.hasError('diferente')).toBe(true);

    component['form'].setValue({ senha: '', confirmacao: '' });
    expect(component['mensagemDaSenha']()).toBe('A senha é obrigatória');
  });

  it('deve definir a nova senha e fechar confirmando', () => {
    component['form'].setValue({ senha: 'novaSenha1', confirmacao: 'novaSenha1' });
    component['salvar']();

    expect(service.redefinirSenha).toHaveBeenCalledWith('maria', 'novaSenha1');
    expect(fechar).toHaveBeenCalledWith(true);
  });

  it('deve mostrar o motivo quando a API recusar a senha', () => {
    service.redefinirSenha.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({ status: 400, error: { erros: [{ campo: 'senha', mensagem: 'Senha recusada' }] } }),
      ),
    );
    component['form'].setValue({ senha: 'novaSenha1', confirmacao: 'novaSenha1' });
    component['salvar']();

    expect(component['mensagemDaSenha']()).toBe('Senha recusada');
    expect(fechar).not.toHaveBeenCalled();
  });
});
