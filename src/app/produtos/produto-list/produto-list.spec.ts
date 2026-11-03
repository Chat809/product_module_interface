import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { ProdutoDialogs } from '../produto-dialogs.service';
import { Produto } from '../produto.model';
import { ProdutoService } from '../produto.service';
import { ProdutoStore } from '../produto.store';
import { ProdutoList } from './produto-list';

function produto(nome: string, quantidadeEmEstoque: number, preco = 10): Produto {
  return {
    id: nome,
    nome,
    descricao: null,
    preco,
    quantidadeEmEstoque,
    criadoEm: '2026-11-01T10:00:00Z',
    atualizadoEm: '2026-11-01T10:00:00Z',
    versao: 0,
  };
}

describe('ProdutoList', () => {
  // 12 produtos: 2 esgotados, 2 com estoque baixo e 8 disponíveis.
  const catalogo: Produto[] = [
    produto('Café Especial', 0, 39.9),
    produto('Caneca', 0, 45),
    produto('Mouse', 3, 89.9),
    produto('Teclado', 5, 349.9),
    ...Array.from({ length: 8 }, (_, i) => produto(`Item ${String.fromCharCode(65 + i)}`, 20 + i, 100 + i)),
  ];

  let fixture: ComponentFixture<ProdutoList>;
  let component: ProdutoList;
  let elemento: HTMLElement;
  let produtoService: { listarCatalogo: ReturnType<typeof vi.fn>; remover: ReturnType<typeof vi.fn> };
  let confirmacao: boolean;

  beforeEach(async () => {
    produtoService = { listarCatalogo: vi.fn(() => of(catalogo)), remover: vi.fn(() => of(undefined)) };
    confirmacao = true;

    TestBed.configureTestingModule({
      imports: [ProdutoList],
      providers: [
        { provide: ProdutoService, useValue: produtoService },
        { provide: ProdutoDialogs, useValue: { formulario: vi.fn(() => of(undefined)), movimentar: vi.fn() } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirmacao) }) } },
        { provide: Notificacao, useValue: { sucesso: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ProdutoList);
    component = fixture.componentInstance;
    elemento = fixture.nativeElement;
    await fixture.whenStable();
  });

  function nomesNaTabela(): string[] {
    return Array.from(elemento.querySelectorAll('td .nome')).map((td) => td.textContent!.trim());
  }

  async function atualizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('deve carregar o catálogo uma vez e exibir a primeira página ordenada por nome', () => {
    expect(produtoService.listarCatalogo).toHaveBeenCalledTimes(1);
    expect(nomesNaTabela()).toHaveLength(10);
    expect(nomesNaTabela()[0]).toBe('Café Especial');
  });

  it('deve filtrar enquanto digita, ignorando acentos, sem nova chamada à API', async () => {
    component['buscar']('cafe');
    await atualizar();

    expect(nomesNaTabela()).toEqual(['Café Especial']);
    expect(elemento.querySelector('mark.destaque')?.textContent).toBe('Café');
    expect(produtoService.listarCatalogo).toHaveBeenCalledTimes(1);
  });

  it('deve mostrar as contagens nos chips e filtrar pela situação do estoque', async () => {
    expect(component['contagens']()).toEqual({ todos: 12, disponivel: 8, baixo: 2, esgotado: 2 });

    component['filtrarPorSituacao']('esgotado');
    await atualizar();
    expect(nomesNaTabela()).toEqual(['Café Especial', 'Caneca']);

    component['filtrarPorSituacao']('baixo');
    await atualizar();
    expect(nomesNaTabela()).toEqual(['Mouse', 'Teclado']);
  });

  it('deve ordenar pela opção escolhida', async () => {
    component['ordenarPor']({ coluna: 'preco', direcao: 'desc' });
    await atualizar();

    expect(nomesNaTabela()[0]).toBe('Teclado');
  });

  it('deve paginar no navegador e voltar à primeira página ao filtrar', async () => {
    component['mudarPagina']({ pageIndex: 1, pageSize: 10, length: 12 });
    await atualizar();
    expect(nomesNaTabela()).toHaveLength(2);

    component['buscar']('item');
    expect(component['pagina']()).toBe(0);
  });

  it('deve exibir o estado vazio e limpar os filtros', async () => {
    component['buscar']('inexistente');
    await atualizar();
    expect(elemento.textContent).toContain('Nenhum produto encontrado');

    component['limparFiltros']();
    await atualizar();
    expect(nomesNaTabela()).toHaveLength(10);
  });

  it('deve excluir após a confirmação e remover do catálogo local', async () => {
    const store = TestBed.inject(ProdutoStore);

    component['confirmarExclusao'](catalogo[0]);

    expect(produtoService.remover).toHaveBeenCalledWith('Café Especial');
    expect(store.produtos()).toHaveLength(11);
  });

  it('não deve excluir quando a confirmação for cancelada', () => {
    confirmacao = false;

    component['confirmarExclusao'](catalogo[0]);

    expect(produtoService.remover).not.toHaveBeenCalled();
  });
});
