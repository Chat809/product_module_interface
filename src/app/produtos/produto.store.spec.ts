import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Produto } from './produto.model';
import { ProdutoService } from './produto.service';
import { ProdutoStore } from './produto.store';

describe('ProdutoStore', () => {
  const teclado: Produto = {
    id: 'a',
    nome: 'Teclado',
    descricao: null,
    preco: 10,
    quantidadeEmEstoque: 1,
    criadoEm: '2026-11-01T10:00:00Z',
    atualizadoEm: '2026-11-01T10:00:00Z',
    versao: 0,
  };
  const mouse: Produto = { ...teclado, id: 'b', nome: 'Mouse' };

  let store: ProdutoStore;
  let listarCatalogo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listarCatalogo = vi.fn().mockReturnValue(of([teclado]));
    TestBed.configureTestingModule({
      providers: [{ provide: ProdutoService, useValue: { listarCatalogo } }],
    });
    store = TestBed.inject(ProdutoStore);
  });

  it('deve carregar o catálogo uma única vez, a menos que seja forçado', () => {
    store.carregar();
    store.carregar();
    expect(listarCatalogo).toHaveBeenCalledTimes(1);
    expect(store.produtos()).toEqual([teclado]);

    store.carregar(true);
    expect(listarCatalogo).toHaveBeenCalledTimes(2);
  });

  it('deve atualizar o catálogo localmente sem voltar à API', () => {
    store.carregar();

    store.adicionar(mouse);
    store.substituir({ ...teclado, quantidadeEmEstoque: 9 });
    store.remover('b');

    expect(store.produtos()).toEqual([{ ...teclado, quantidadeEmEstoque: 9 }]);
    expect(store.indice()[0].chave).toContain('teclado');
    expect(listarCatalogo).toHaveBeenCalledTimes(1);
  });
});
