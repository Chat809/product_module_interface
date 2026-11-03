import { Injectable, computed, inject, signal } from '@angular/core';
import { indexar } from './produto-filtro';
import { Produto } from './produto.model';
import { ProdutoService } from './produto.service';

const LIMITE_ESTOQUE_BAIXO_PADRAO = 5;

/**
 * Catálogo em memória compartilhado pelas telas. É carregado uma vez e atualizado
 * localmente após cada operação, então buscas e filtros não voltam à API.
 */
@Injectable({ providedIn: 'root' })
export class ProdutoStore {
  private readonly produtoService = inject(ProdutoService);

  private readonly estado = signal<Produto[]>([]);
  private readonly carregado = signal(false);

  readonly produtos = this.estado.asReadonly();
  readonly indice = computed(() => indexar(this.estado()));
  readonly carregando = signal(false);
  readonly erro = signal(false);
  /** Atualizado com o valor configurado na API quando o resumo é carregado. */
  readonly limiteEstoqueBaixo = signal(LIMITE_ESTOQUE_BAIXO_PADRAO);

  carregar(forcar = false): void {
    if (this.carregando() || (this.carregado() && !forcar)) {
      return;
    }
    this.carregando.set(true);
    this.erro.set(false);
    this.produtoService.listarCatalogo().subscribe({
      next: (produtos) => {
        this.estado.set(produtos);
        this.carregado.set(true);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.carregando.set(false);
      },
    });
  }

  adicionar(produto: Produto): void {
    this.estado.update((lista) => [...lista, produto]);
  }

  substituir(produto: Produto): void {
    this.estado.update((lista) => lista.map((p) => (p.id === produto.id ? produto : p)));
  }

  remover(id: string): void {
    this.estado.update((lista) => lista.filter((p) => p.id !== id));
  }
}
