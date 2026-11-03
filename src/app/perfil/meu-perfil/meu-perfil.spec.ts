import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { Demanda } from '../../demandas/demanda.model';
import { DemandaService } from '../../demandas/demanda.service';
import { MeuPerfil, PerfilService } from '../perfil.service';
import { MeuPerfilPage } from './meu-perfil';

const perfil: MeuPerfil = {
  id: 'u1',
  nome: 'Maria Souza',
  email: 'maria@exemplo.com',
  papel: 'USUARIO',
  acessos: ['dashboard', 'demandas'],
  criadoEm: '2026-11-01T10:00:00Z',
  telefone: '(11) 91234-5678',
  funcao: 'Compradora',
  bio: null,
  avatarUrl: null,
  departamento: 'Compras',
};

const tarefa = {
  id: 'd1',
  titulo: 'Conferir pedido',
  descricao: null,
  status: 'EM_ANDAMENTO',
  urgencia: 'ALTA',
  tipo: 'TAREFA',
  prazo: '2026-11-01',
  atrasada: true,
  responsaveis: ['u1'],
  checklist: [
    { texto: 'Separar notas', feito: true },
    { texto: 'Conferir itens', feito: false },
  ],
  ordem: 0,
  criadoPor: 'u2',
  criadoEm: null,
  atualizadoEm: null,
} satisfies Demanda;

describe('MeuPerfilPage', () => {
  let fixture: ComponentFixture<MeuPerfilPage>;
  let component: MeuPerfilPage;
  let elemento: HTMLElement;
  let perfilService: Record<'buscar' | 'atualizar' | 'enviarAvatar' | 'removerAvatar', ReturnType<typeof vi.fn>>;
  let demandaService: { listar: ReturnType<typeof vi.fn> };
  let auth: { podeAcessar: ReturnType<typeof vi.fn>; atualizarUsuario: ReturnType<typeof vi.fn> };
  let notificacao: Record<'sucesso' | 'erro', ReturnType<typeof vi.fn>>;

  async function criar(temDemandas = true): Promise<void> {
    auth.podeAcessar.mockReturnValue(temDemandas);
    TestBed.configureTestingModule({
      imports: [MeuPerfilPage],
      providers: [
        provideRouter([]),
        { provide: PerfilService, useValue: perfilService },
        { provide: DemandaService, useValue: demandaService },
        { provide: AuthService, useValue: auth },
        { provide: Notificacao, useValue: notificacao },
      ],
    });
    fixture = TestBed.createComponent(MeuPerfilPage);
    component = fixture.componentInstance;
    elemento = fixture.nativeElement;
    await fixture.whenStable();
  }

  function escolher(arquivo: File): void {
    const campo = { files: [arquivo], value: 'C:\\fakepath\\x' } as unknown as HTMLInputElement;
    component['escolherFoto']({ target: campo } as unknown as Event);
  }

  beforeEach(() => {
    perfilService = {
      buscar: vi.fn(() => of(perfil)),
      atualizar: vi.fn((dados) => of({ ...perfil, ...dados })),
      enviarAvatar: vi.fn(() => of({ ...perfil, avatarUrl: 'https://exemplo.com/a.png' })),
      removerAvatar: vi.fn(() => of(perfil)),
    };
    demandaService = { listar: vi.fn(() => of([tarefa])) };
    auth = { podeAcessar: vi.fn(), atualizarUsuario: vi.fn() };
    notificacao = { sucesso: vi.fn(), erro: vi.fn() };
  });

  it('deve exibir departamento, cargo e nível só para leitura e preencher o formulário', async () => {
    await criar();
    const texto = elemento.textContent!;
    expect(texto).toContain('maria@exemplo.com');
    expect(texto).toContain('Compras');
    expect(texto).toContain('Compradora');
    expect(texto).toContain('Nível de acesso');
    expect(texto).toContain('Usuário');
    expect(texto).toContain('Dashboard, Demandas');
    expect(component['form'].getRawValue()).toEqual({
      nome: 'Maria Souza',
      telefone: '(11) 91234-5678',
      bio: '',
    });
    expect(auth.atualizarUsuario).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', avatarUrl: null }));
  });

  it('deve listar as demandas abertas em que a pessoa é responsável', async () => {
    await criar();
    expect(demandaService.listar).toHaveBeenCalledWith({ responsavel: 'me', abertas: true });
    const item = elemento.querySelector<HTMLAnchorElement>('a.tarefa')!;
    expect(item.textContent).toContain('Conferir pedido');
    expect(item.textContent).toContain('Em andamento');
    expect(item.textContent).toContain('1/2');
    expect(item.querySelector('.atrasada')).not.toBeNull();
    expect(item.getAttribute('href')).toBe('/demandas?abrir=d1');
  });

  it('sem o módulo de demandas não deve buscar nem mostrar tarefas', async () => {
    await criar(false);
    expect(demandaService.listar).not.toHaveBeenCalled();
    expect(elemento.textContent).not.toContain('Minhas tarefas');
  });

  it('deve salvar enviando campos vazios como nulos e atualizar a sessão', async () => {
    await criar();
    component['form'].patchValue({ nome: '  Maria S.  ', telefone: '', bio: 'Oi' });
    component['salvar']();

    expect(perfilService.atualizar).toHaveBeenCalledWith({ nome: 'Maria S.', telefone: null, bio: 'Oi' });
    expect(auth.atualizarUsuario).toHaveBeenLastCalledWith(expect.objectContaining({ nome: 'Maria S.' }));
    expect(notificacao.sucesso).toHaveBeenCalledWith('Perfil atualizado.');
  });

  it('não deve salvar com telefone inválido e deve mostrar erros vindos da API', async () => {
    await criar();
    component['form'].patchValue({ telefone: 'abc' });
    component['salvar']();
    expect(perfilService.atualizar).not.toHaveBeenCalled();
    expect(component['mensagemDeErro']('telefone')).toBe('Use apenas números, espaços, parênteses, + e -');

    component['form'].patchValue({ telefone: '' });
    perfilService.atualizar.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { erros: [{ campo: 'bio', mensagem: 'Bio inválida' }] } }),
      ),
    );
    component['salvar']();
    expect(component['mensagemDeErro']('bio')).toBe('Bio inválida');
  });

  it('deve recusar foto de outro tipo ou maior que 2 MB antes de enviar', async () => {
    await criar();
    escolher(new File(['x'], 'foto.gif', { type: 'image/gif' }));
    expect(notificacao.erro).toHaveBeenCalledWith('Escolha uma imagem PNG, JPG ou WebP.');

    escolher(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' }));
    expect(notificacao.erro).toHaveBeenCalledWith('A imagem deve ter no máximo 2 MB.');
    expect(perfilService.enviarAvatar).not.toHaveBeenCalled();
  });

  it('deve enviar e remover a foto, refletindo no topo do painel', async () => {
    await criar();
    const arquivo = new File(['x'], 'foto.webp', { type: 'image/webp' });
    escolher(arquivo);
    expect(perfilService.enviarAvatar).toHaveBeenCalledWith(arquivo);
    expect(auth.atualizarUsuario).toHaveBeenLastCalledWith(
      expect.objectContaining({ avatarUrl: 'https://exemplo.com/a.png' }),
    );
    expect(notificacao.sucesso).toHaveBeenCalledWith('Foto atualizada.');

    component['removerFoto']();
    expect(perfilService.removerAvatar).toHaveBeenCalled();
    expect(notificacao.sucesso).toHaveBeenCalledWith('Foto removida.');
  });

  it('deve exibir o estado de erro quando não conseguir carregar o perfil', async () => {
    perfilService.buscar.mockReturnValue(throwError(() => new Error('falha')));
    await criar();
    expect(elemento.textContent).toContain('Não foi possível carregar o seu perfil');
  });
});
