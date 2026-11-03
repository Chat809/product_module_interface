import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { Movimentacao, Produto } from '../produto.model';
import { ProdutoService } from '../produto.service';
import { ProdutoStore } from '../produto.store';
import { MovimentacaoDialog, MovimentacaoDialogData } from './movimentacao-dialog';

describe('MovimentacaoDialog', () => {
  const produto: Produto = {
    id: 'p1',
    nome: 'Mouse',
    descricao: null,
    preco: 89.9,
    quantidadeEmEstoque: 5,
    criadoEm: '2026-11-01T10:00:00Z',
    atualizadoEm: '2026-11-01T10:00:00Z',
    versao: 1,
  };
  const historico: Movimentacao[] = [
    {
      id: 'm1',
      produtoId: 'p1',
      tipo: 'ENTRADA',
      quantidade: 5,
      saldoAnterior: 0,
      saldoApos: 5,
      motivo: 'Estoque inicial',
      criadoEm: '2026-11-01T10:00:00Z',
    },
  ];

  let fixture: ComponentFixture<MovimentacaoDialog>;
  let component: MovimentacaoDialog;
  let produtoService: Record<'historico' | 'movimentar' | 'buscarPorId', ReturnType<typeof vi.fn>>;
  let store: { substituir: ReturnType<typeof vi.fn>; carregar: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  async function criar(data: MovimentacaoDialogData): Promise<void> {
    produtoService = {
      historico: vi.fn(() => of({ conteudo: historico, pagina: 0, tamanho: 5, totalElementos: 1, totalPaginas: 1 })),
      movimentar: vi.fn(() => of({})),
      buscarPorId: vi.fn(() => of({ ...produto, quantidadeEmEstoque: 8, versao: 2 })),
    };
    store = { substituir: vi.fn(), carregar: vi.fn() };
    dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [MovimentacaoDialog],
      providers: [
        { provide: ProdutoService, useValue: produtoService },
        { provide: ProdutoStore, useValue: store },
        { provide: Notificacao, useValue: { sucesso: vi.fn() } },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    fixture = TestBed.createComponent(MovimentacaoDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  it('deve carregar o histórico do produto ao abrir', async () => {
    await criar({ produto });

    expect(produtoService.historico).toHaveBeenCalledWith('p1');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Entrada de 5');
  });

  it('deve calcular o saldo previsto para entrada e saída', async () => {
    await criar({ produto });

    component['form'].patchValue({ quantidade: 3 });
    expect(component['saldoPrevisto']()).toBe(8);

    component['form'].patchValue({ tipo: 'SAIDA' });
    expect(component['saldoPrevisto']()).toBe(2);
  });

  it('deve bloquear uma saída maior que o estoque', async () => {
    await criar({ produto, tipo: 'SAIDA' });

    component['form'].patchValue({ quantidade: 6 });
    fixture.detectChanges();
    component['registrar']();

    expect(component['estoqueInsuficiente']()).toBe(true);
    expect(produtoService.movimentar).not.toHaveBeenCalled();
    const botao = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(botao?.disabled).toBe(true);
  });

  it('deve registrar, atualizar o produto no catálogo e fechar', async () => {
    await criar({ produto });

    component['form'].patchValue({ quantidade: 3, motivo: '  Reposição  ' });
    component['registrar']();

    expect(produtoService.movimentar).toHaveBeenCalledWith('p1', {
      tipo: 'ENTRADA',
      quantidade: 3,
      motivo: 'Reposição',
    });
    expect(store.substituir).toHaveBeenCalledWith(expect.objectContaining({ quantidadeEmEstoque: 8 }));
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('deve exigir a quantidade', async () => {
    await criar({ produto });

    component['registrar']();

    expect(produtoService.movimentar).not.toHaveBeenCalled();
    expect(component['mensagemQuantidade']()).toBe('Informe a quantidade');
  });
});
