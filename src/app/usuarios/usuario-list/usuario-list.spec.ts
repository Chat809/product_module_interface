import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { Usuario } from '../../core/auth/auth.model';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { UsuarioService } from '../usuario.service';
import { UsuarioList } from './usuario-list';

function usuario(id: string, nome: string, papel: Usuario['papel']): Usuario {
  return { id, nome, email: `${id}@exemplo.com`, papel, criadoEm: '2026-11-03T08:00:00Z' };
}

describe('UsuarioList', () => {
  const eu = usuario('admin', 'Khalil', 'ADMIN');
  const maria = usuario('maria', 'Maria', 'USUARIO');

  let fixture: ComponentFixture<UsuarioList>;
  let component: UsuarioList;
  let elemento: HTMLElement;
  let service: { listar: ReturnType<typeof vi.fn>; alterarPapel: ReturnType<typeof vi.fn> };
  let notificacao: { sucesso: ReturnType<typeof vi.fn> };
  let confirmacao: boolean;

  beforeEach(async () => {
    service = {
      listar: vi.fn(() => of({ conteudo: [eu, maria], pagina: 0, tamanho: 10, totalElementos: 2, totalPaginas: 1 })),
      alterarPapel: vi.fn(() => of({ ...maria, papel: 'ADMIN' })),
    };
    notificacao = { sucesso: vi.fn() };
    confirmacao = true;

    TestBed.configureTestingModule({
      imports: [UsuarioList],
      providers: [
        { provide: UsuarioService, useValue: service },
        { provide: AuthService, useValue: { usuario: signal(eu) } },
        { provide: Notificacao, useValue: notificacao },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirmacao) }) } },
      ],
    });
    fixture = TestBed.createComponent(UsuarioList);
    component = fixture.componentInstance;
    elemento = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('deve listar os usuários e marcar a própria conta', () => {
    expect(service.listar).toHaveBeenCalledWith(0, 10);
    const nomes = Array.from(elemento.querySelectorAll('td .nome')).map((td) => td.textContent!.trim());
    expect(nomes).toEqual(['Khalil', 'Maria']);
    expect(elemento.querySelector('.voce')?.textContent).toBe('você');
    expect(component['ehVoce'](eu)).toBe(true);
    expect(component['ehVoce'](maria)).toBe(false);
  });

  it('deve paginar pela API', () => {
    component['mudarPagina']({ pageIndex: 1, pageSize: 25, length: 30 });
    expect(service.listar).toHaveBeenLastCalledWith(1, 25);
  });

  it('deve promover após a confirmação e atualizar a linha', () => {
    component['alterarPapel'](maria, 'ADMIN');

    expect(service.alterarPapel).toHaveBeenCalledWith('maria', 'ADMIN');
    expect(component['usuarios']().find((u) => u.id === 'maria')?.papel).toBe('ADMIN');
    expect(notificacao.sucesso).toHaveBeenCalledWith('Maria agora é administrador.');
  });

  it('não deve alterar quando a confirmação for cancelada', () => {
    confirmacao = false;
    component['alterarPapel'](maria, 'ADMIN');

    expect(service.alterarPapel).not.toHaveBeenCalled();
    expect(component['usuarios']().find((u) => u.id === 'maria')?.papel).toBe('USUARIO');
  });

  it('deve recarregar a lista se a API recusar a alteração', () => {
    service.alterarPapel.mockReturnValue(throwError(() => new Error('422')));
    component['alterarPapel'](maria, 'ADMIN');
    expect(service.listar).toHaveBeenCalledTimes(2);
  });

  it('deve exibir o estado de erro quando não conseguir carregar', async () => {
    service.listar.mockReturnValue(throwError(() => new Error('falha')));
    component['usuarios'].set([]);
    component['carregar']();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Não foi possível carregar os usuários');
  });
});
