import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { Skeleton } from '../shared/skeleton/skeleton';
import { ProdutoDialogs } from '../produtos/produto-dialogs.service';
import { Produto, ResumoEstoque } from '../produtos/produto.model';
import { ProdutoService } from '../produtos/produto.service';
import { ProdutoStore } from '../produtos/produto.store';

const ITENS_PARA_REPOR = 6;

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DecimalPipe, MatButtonModule, MatIconModule, RouterLink, Skeleton],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly produtoService = inject(ProdutoService);
  private readonly dialogs = inject(ProdutoDialogs);
  protected readonly store = inject(ProdutoStore);
  /** Quem só tem o dashboard vê os números, mas não registra entradas nem abre o catálogo. */
  protected readonly gerenciaProdutos = inject(AuthService).podeAcessar('produtos');

  protected readonly resumo = signal<ResumoEstoque | null>(null);
  protected readonly erroNoResumo = signal(false);

  /** Esgotados primeiro, depois os de menor estoque. */
  protected readonly paraRepor = computed(() =>
    this.store
      .produtos()
      .filter((p) => p.quantidadeEmEstoque <= this.store.limiteEstoqueBaixo())
      .sort((a, b) => a.quantidadeEmEstoque - b.quantidadeEmEstoque || a.nome.localeCompare(b.nome))
      .slice(0, ITENS_PARA_REPOR),
  );

  ngOnInit(): void {
    this.store.carregar();
    this.carregarResumo();
  }

  protected carregarResumo(): void {
    this.erroNoResumo.set(false);
    this.produtoService.resumo().subscribe({
      next: (resumo) => {
        this.resumo.set(resumo);
        this.store.limiteEstoqueBaixo.set(resumo.limiteEstoqueBaixo);
      },
      error: () => this.erroNoResumo.set(true),
    });
  }

  protected repor(produto: Produto): void {
    this.dialogs
      .movimentar(produto, 'ENTRADA')
      .pipe(filter(Boolean))
      .subscribe(() => this.carregarResumo());
  }
}
