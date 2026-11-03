import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { Usuario } from '../../core/auth/auth.model';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { UsuarioService } from '../usuario.service';
import { UsuarioFormData, UsuarioFormDialog } from './usuario-form';

describe('UsuarioFormDialog', () => {
  const maria: Usuario = {
    id: 'maria',
    nome: 'Maria',
    email: 'maria@exemplo.com',
    papel: 'USUARIO',
    acessos: ['dashboard'],
    criadoEm: null,
  };

  let fixture: ComponentFixture<UsuarioFormDialog>;
  let component: UsuarioFormDialog;
  let service: Record<'atualizar' | 'enviarAvatar' | 'removerAvatar', ReturnType<typeof vi.fn>>;
  let notificacao: Record<'sucesso' | 'erro', ReturnType<typeof vi.fn>>;
  let fechar: ReturnType<typeof vi.fn>;

  async function criar(data: UsuarioFormData): Promise<void> {
    service = {
      atualizar: vi.fn((_id, dados) => of({ ...maria, ...dados })),
      enviarAvatar: vi.fn(() => of({ ...maria, avatarUrl: 'https://exemplo.com/maria.png' })),
      removerAvatar: vi.fn(() => of({ ...maria, avatarUrl: null })),
    };
    notificacao = { sucesso: vi.fn(), erro: vi.fn() };
    fechar = vi.fn();
    TestBed.configureTestingModule({
      imports: [UsuarioFormDialog],
      providers: [
        { provide: UsuarioService, useValue: service },
        { provide: Notificacao, useValue: notificacao },
        { provide: MatDialogRef, useValue: { close: fechar } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    fixture = TestBed.createComponent(UsuarioFormDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  }

  it('deve abrir com os dados atuais e os módulos marcados', async () => {
    await criar({ usuario: maria, ehVoce: false });
    const form = component['form'].getRawValue();

    expect(form.nome).toBe('Maria');
    expect(form.total).toBe(false);
    expect(form.modulos).toEqual({ dashboard: true, produtos: false, demandas: false, financeiro: false });
    expect(texto()).toContain('exclusivo de administradores');
  });

  it('deve salvar apenas os módulos marcados, com departamento e cargo', async () => {
    await criar({ usuario: maria, ehVoce: false });
    component['form'].patchValue({
      nome: ' Maria Souza ',
      departamento: ' Tecnologia ',
      funcao: 'Desenvolvedora',
      modulos: { produtos: true },
    });
    component['salvar']();

    expect(service.atualizar).toHaveBeenCalledWith('maria', {
      nome: 'Maria Souza',
      email: 'maria@exemplo.com',
      papel: 'USUARIO',
      acessos: ['dashboard', 'produtos'],
      departamento: 'Tecnologia',
      funcao: 'Desenvolvedora',
    });
    expect(fechar).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Maria Souza' }));
  });

  it('deve enviar departamento e cargo vazios como nulos e sugerir departamentos', async () => {
    await criar({ usuario: { ...maria, departamento: 'Compras', funcao: 'Compradora' }, ehVoce: false });
    expect(component['form'].getRawValue()).toEqual(
      expect.objectContaining({ departamento: 'Compras', funcao: 'Compradora' }),
    );
    expect(component['departamentos']()).toEqual(['Compras']);

    component['form'].patchValue({ departamento: 'tec', funcao: ' ' });
    expect(component['departamentos']()).toEqual(['Tecnologia']);
    component['form'].patchValue({ departamento: '' });
    component['salvar']();

    expect(service.atualizar.mock.calls[0][1]).toEqual(expect.objectContaining({ departamento: null, funcao: null }));
  });

  it('deve trocar e remover a foto da pessoa, avisando a lista', async () => {
    await criar({ usuario: maria, ehVoce: false });
    const avisos: Usuario[] = [];
    component.avatarAlterado.subscribe((u) => avisos.push(u));
    const escolher = (arquivo: File) =>
      component['escolherFoto']({ target: { files: [arquivo], value: 'x' } } as unknown as Event);

    escolher(new File(['x'], 'foto.gif', { type: 'image/gif' }));
    expect(notificacao.erro).toHaveBeenCalledWith('Escolha uma imagem PNG, JPG ou WebP.');
    expect(service.enviarAvatar).not.toHaveBeenCalled();

    const arquivo = new File(['x'], 'foto.png', { type: 'image/png' });
    escolher(arquivo);
    expect(service.enviarAvatar).toHaveBeenCalledWith('maria', arquivo);
    expect(component['avatarUrl']()).toBe('https://exemplo.com/maria.png');
    expect(notificacao.sucesso).toHaveBeenCalledWith('Foto atualizada.');

    component['removerFoto']();
    expect(service.removerAvatar).toHaveBeenCalledWith('maria');
    expect(component['avatarUrl']()).toBeNull();
    expect(avisos.map((u) => u.avatarUrl)).toEqual(['https://exemplo.com/maria.png', null]);
  });

  it("acesso total deve enviar ['*']", async () => {
    await criar({ usuario: maria, ehVoce: false });
    component['form'].patchValue({ total: true });
    component['salvar']();

    expect(service.atualizar.mock.calls[0][1].acessos).toEqual(['*']);
  });

  it('deve permitir salvar sem nenhum módulo', async () => {
    await criar({ usuario: maria, ehVoce: false });
    component['form'].patchValue({ modulos: { dashboard: false } });
    component['salvar']();

    expect(service.atualizar.mock.calls[0][1].acessos).toEqual([]);
  });

  it('promover a administrador deve enviar acesso total e explicar a regra', async () => {
    await criar({ usuario: maria, ehVoce: false });
    component['form'].controls.papel.setValue('ADMIN');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(texto()).toContain('Administradores têm acesso total');
    component['salvar']();
    expect(service.atualizar.mock.calls[0][1]).toEqual(expect.objectContaining({ papel: 'ADMIN', acessos: ['*'] }));
  });

  it('na própria conta o cargo fica travado, mas ainda é enviado', async () => {
    const eu: Usuario = { ...maria, id: 'eu', papel: 'ADMIN', acessos: ['*'] };
    await criar({ usuario: eu, ehVoce: true });

    expect(component['form'].controls.papel.disabled).toBe(true);
    component['salvar']();
    expect(service.atualizar.mock.calls[0][1].papel).toBe('ADMIN');
  });

  it('não deve chamar a API com campos inválidos', async () => {
    await criar({ usuario: maria, ehVoce: false });
    component['form'].patchValue({ nome: ' ', email: 'x' });
    component['salvar']();

    expect(service.atualizar).not.toHaveBeenCalled();
    expect(component['mensagemDeErro']('nome')).toBe('O nome é obrigatório');
    expect(component['mensagemDeErro']('email')).toBe('Informe um e-mail válido');
  });

  it('deve marcar o e-mail quando ele já pertencer a outra conta', async () => {
    await criar({ usuario: maria, ehVoce: false });
    service.atualizar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    component['salvar']();

    expect(component['mensagemDeErro']('email')).toBe('Este e-mail já pertence a outra conta');
    expect(fechar).not.toHaveBeenCalled();
  });

  it('deve exibir os erros por campo devolvidos pela API', async () => {
    await criar({ usuario: maria, ehVoce: false });
    service.atualizar.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { erros: [{ campo: 'nome', mensagem: 'Nome recusado' }] } }),
      ),
    );
    component['salvar']();

    expect(component['mensagemDeErro']('nome')).toBe('Nome recusado');
  });
});
