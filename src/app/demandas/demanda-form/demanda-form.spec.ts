import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Demanda } from '../demanda.model';
import { DemandaService } from '../demanda.service';
import { DemandaFormData, DemandaFormDialog } from './demanda-form';

const existente: Demanda = {
  id: 'd1',
  titulo: 'Revisar estoque',
  descricao: 'Contagem mensal',
  status: 'EM_ANDAMENTO',
  urgencia: 'ALTA',
  tipo: 'MELHORIA',
  prazo: '2026-11-20',
  atrasada: false,
  responsaveis: ['u1', 'saiu'],
  checklist: [{ texto: 'Contar', feito: true }],
  ordem: 0,
  criadoPor: 'u1',
  criadoEm: null,
  atualizadoEm: null,
};

describe('DemandaFormDialog', () => {
  let fixture: ComponentFixture<DemandaFormDialog>;
  let component: DemandaFormDialog;
  let service: Record<'criar' | 'atualizar' | 'excluir', ReturnType<typeof vi.fn>>;
  let fechar: ReturnType<typeof vi.fn>;
  let confirmacao: boolean;

  async function criar(data: Partial<DemandaFormData>): Promise<void> {
    TestBed.configureTestingModule({
      imports: [DemandaFormDialog],
      providers: [
        { provide: DemandaService, useValue: service },
        { provide: MatDialogRef, useValue: { close: fechar } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { opcoes: [{ id: 'u1', nome: 'Maria', avatarUrl: null }], podeExcluir: false, ...data },
        },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: { open: () => ({ afterClosed: () => of(confirmacao) }) } });
    fixture = TestBed.createComponent(DemandaFormDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(() => {
    service = {
      criar: vi.fn((dados) => of({ ...existente, ...dados, id: 'nova' })),
      atualizar: vi.fn((id, dados) => of({ ...existente, ...dados })),
      excluir: vi.fn(() => of(undefined)),
    };
    fechar = vi.fn();
    confirmacao = true;
  });

  it('deve criar na coluna escolhida com o checklist montado', async () => {
    await criar({ status: 'EM_REVISAO' });
    component['form'].patchValue({ titulo: '  Nova tarefa ', responsaveis: ['u1'] });
    component['novoItem'].setValue('Primeiro passo');
    component['adicionarItem']();
    component['novoItem'].setValue('   ');
    component['adicionarItem']();
    component['salvar']();

    expect(service.criar).toHaveBeenCalledWith({
      titulo: 'Nova tarefa',
      descricao: null,
      tipo: 'TAREFA',
      urgencia: 'MEDIA',
      status: 'EM_REVISAO',
      prazo: null,
      responsaveis: ['u1'],
      checklist: [{ texto: 'Primeiro passo', feito: false }],
    });
    expect(fechar).toHaveBeenCalledWith({ tipo: 'salva', demanda: expect.objectContaining({ id: 'nova' }) });
  });

  it('não deve salvar sem título', async () => {
    await criar({});
    component['form'].patchValue({ titulo: '   ' });
    component['salvar']();
    expect(service.criar).not.toHaveBeenCalled();
    expect(component['mensagemDeErro']('titulo')).toBe('O título é obrigatório');
  });

  it('deve editar mantendo responsáveis que saíram e permitindo remover itens', async () => {
    await criar({ demanda: existente });
    expect(component['opcoes'].map((o) => o.nome)).toEqual(['Maria', 'Usuário removido']);
    expect(component['progresso']()).toEqual({ feitos: 1, total: 1 });

    component['removerItem'](0);
    expect(component['progresso']()).toEqual({ feitos: 0, total: 0 });
    component['salvar']();

    expect(service.atualizar).toHaveBeenCalledWith('d1', expect.objectContaining({ checklist: [], status: 'EM_ANDAMENTO' }));
  });

  it('deve excluir só depois da confirmação, quando permitido', async () => {
    await criar({ demanda: existente, podeExcluir: true });
    expect(fixture.nativeElement.querySelector('.excluir')).not.toBeNull();

    confirmacao = false;
    component['excluir']();
    expect(service.excluir).not.toHaveBeenCalled();

    confirmacao = true;
    component['excluir']();
    expect(service.excluir).toHaveBeenCalledWith('d1');
    expect(fechar).toHaveBeenCalledWith({ tipo: 'excluida', id: 'd1' });
  });

  it('não deve mostrar o botão de excluir para quem não pode', async () => {
    await criar({ demanda: existente, podeExcluir: false });
    expect(fixture.nativeElement.querySelector('.excluir')).toBeNull();
  });
});
