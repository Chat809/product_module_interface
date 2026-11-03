import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { Usuario } from '../../core/auth/auth.model';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { SenhaDialog } from '../senha-dialog/senha-dialog';
import { UsuarioFormDialog } from '../usuario-form/usuario-form';
import { UsuarioService } from '../usuario.service';
import { UsuarioList } from './usuario-list';

function usuario(id: string, nome: string, papel: Usuario['papel'], acessos: string[]): Usuario {
  return { id, nome, email: `${id}@exemplo.com`, papel, acessos, criadoEm: '2026-11-03T08:00:00Z' };
}

describe('UsuarioList', () => {
  const eu = { ...usuario('admin', 'Ana', 'ADMIN', ['*']), departamento: 'Tecnologia', funcao: 'Desenvolvedora' };
  const maria = usuario('maria', 'Maria', 'USUARIO', ['dashboard']);
  const joao = usuario('joao', 'João', 'USUARIO', []);

  let fixture: ComponentFixture<UsuarioList>;
  let component: UsuarioList;
  let elemento: HTMLElement;
  let service: { listar: ReturnType<typeof vi.fn> };
  let auth: { usuario: ReturnType<typeof signal<Usuario>>; atualizarUsuario: ReturnType<typeof vi.fn> };
  let notificacao: { sucesso: ReturnType<typeof vi.fn> };
  let abrir: ReturnType<typeof vi.fn>;
  let resultadoDoDialogo: unknown;
  let avatarAlterado: Subject<Usuario>;

  beforeEach(async () => {
    service = {
      listar: vi.fn(() =>
        of({ conteudo: [eu, maria, joao], pagina: 0, tamanho: 10, totalElementos: 3, totalPaginas: 1 }),
      ),
    };
    auth = { usuario: signal(eu), atualizarUsuario: vi.fn() };
    notificacao = { sucesso: vi.fn() };
    resultadoDoDialogo = undefined;
    avatarAlterado = new Subject<Usuario>();
    abrir = vi.fn(() => ({ afterClosed: () => of(resultadoDoDialogo), componentInstance: { avatarAlterado } }));

    TestBed.configureTestingModule({
      imports: [UsuarioList],
      providers: [
        { provide: UsuarioService, useValue: service },
        { provide: AuthService, useValue: auth },
        { provide: Notificacao, useValue: notificacao },
        { provide: MatDialog, useValue: { open: abrir } },
      ],
    });
    fixture = TestBed.createComponent(UsuarioList);
    component = fixture.componentInstance;
    elemento = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('deve listar departamento, cargo, nível de acesso e acessos em colunas separadas', () => {
    expect(service.listar).toHaveBeenCalledWith(0, 10);
    const cabecalho = Array.from(elemento.querySelectorAll('th')).map((th) => th.textContent!.trim());
    expect(cabecalho).toEqual(expect.arrayContaining(['Departamento', 'Cargo', 'Nível de acesso', 'Acessos']));
    const linhas = Array.from(elemento.querySelectorAll('tr.mat-mdc-row')).map((tr) =>
      tr.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(linhas[0]).toContain('Ana');
    expect(linhas[0]).toContain('Tecnologia');
    expect(linhas[0]).toContain('Desenvolvedora');
    expect(linhas[1]).toContain('Não informado');
    expect(elemento.querySelectorAll('tr.mat-mdc-row')[0].querySelector('.voce')?.textContent).toBe('você');
    expect(linhas[0]).toContain('Administrador');
    expect(linhas[0]).toContain('Acesso total');
    expect(linhas[1]).toContain('Usuário');
    expect(linhas[1]).toContain('Dashboard');
    expect(linhas[2]).toContain('Nenhum módulo');
  });

  it('deve traduzir os acessos para os rótulos dos módulos', () => {
    expect(component['acessos'](eu)).toEqual(['Acesso total']);
    expect(component['acessos']({ ...maria, acessos: ['produtos', 'dashboard'] })).toEqual(['Dashboard', 'Produtos']);
    expect(component['acessos']({ ...maria, acessos: ['*'] })).toEqual(['Acesso total']);
  });

  it('deve paginar pela API', () => {
    component['mudarPagina']({ pageIndex: 1, pageSize: 25, length: 30 });
    expect(service.listar).toHaveBeenLastCalledWith(1, 25);
  });

  it('deve abrir a edição e aplicar o resultado salvo na linha e na sessão', () => {
    const salvo = { ...maria, acessos: ['dashboard', 'produtos'] };
    resultadoDoDialogo = salvo;

    component['editar'](maria);

    expect(abrir).toHaveBeenCalledWith(
      UsuarioFormDialog,
      expect.objectContaining({ data: { usuario: maria, ehVoce: false } }),
    );
    expect(component['usuarios']().find((u) => u.id === 'maria')?.acessos).toEqual(['dashboard', 'produtos']);
    expect(auth.atualizarUsuario).toHaveBeenCalledWith(salvo);
    expect(notificacao.sucesso).toHaveBeenCalledWith('Dados de Maria atualizados.');
  });

  it('deve refletir na linha e na sessão a foto trocada dentro do diálogo', () => {
    component['editar'](maria);
    avatarAlterado.next({ ...maria, avatarUrl: 'https://exemplo.com/maria.png' });

    expect(component['usuarios']().find((u) => u.id === 'maria')?.avatarUrl).toBe('https://exemplo.com/maria.png');
    expect(auth.atualizarUsuario).toHaveBeenCalledWith(expect.objectContaining({ id: 'maria' }));
  });

  it('deve indicar ao diálogo quando o admin edita a própria conta', () => {
    component['editar'](eu);
    expect(abrir).toHaveBeenCalledWith(UsuarioFormDialog, expect.objectContaining({ data: { usuario: eu, ehVoce: true } }));
  });

  it('não deve mudar nada quando a edição for cancelada', () => {
    component['editar'](maria);
    expect(auth.atualizarUsuario).not.toHaveBeenCalled();
    expect(notificacao.sucesso).not.toHaveBeenCalled();
  });

  it('deve abrir o diálogo de senha e confirmar quando definida', () => {
    resultadoDoDialogo = true;
    component['redefinirSenha'](maria);

    expect(abrir).toHaveBeenCalledWith(SenhaDialog, expect.objectContaining({ data: maria }));
    expect(notificacao.sucesso).toHaveBeenCalledWith('Nova senha de Maria definida.');
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
