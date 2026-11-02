import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { filter, finalize, switchMap } from 'rxjs';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { Loading } from '../../shared/loading/loading';
import { Produto } from '../produto.model';
import { ProdutoService } from '../produto.service';

type ColunaOrdenavel = 'nome' | 'preco' | 'quantidadeEmEstoque';

@Component({
  selector: 'app-produto-list',
  imports: [
    CurrencyPipe,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    Loading,
  ],
  templateUrl: './produto-list.html',
  styleUrl: './produto-list.scss',
})
export class ProdutoList implements OnInit {
  private readonly produtoService = inject(ProdutoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly colunas = ['nome', 'descricao', 'preco', 'quantidadeEmEstoque', 'acoes'];
  protected readonly produtos = signal<Produto[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erroAoCarregar = signal(false);
  protected readonly filtro = signal('');
  private readonly ordenacao = signal<Sort>({ active: '', direction: '' });

  protected readonly produtosVisiveis = computed(() => {
    const termo = this.filtro().trim().toLowerCase();
    const filtrados = termo
      ? this.produtos().filter(
          (p) => p.nome.toLowerCase().includes(termo) || p.descricao?.toLowerCase().includes(termo),
        )
      : this.produtos();
    return ordenar(filtrados, this.ordenacao());
  });

  ngOnInit(): void {
    this.carregar();
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.erroAoCarregar.set(false);
    this.produtoService
      .listar()
      .pipe(
        finalize(() => this.carregando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (produtos) => this.produtos.set(produtos),
        error: () => this.erroAoCarregar.set(true),
      });
  }

  protected filtrar(event: Event): void {
    this.filtro.set((event.target as HTMLInputElement).value);
  }

  protected ordenar(sort: Sort): void {
    this.ordenacao.set(sort);
  }

  protected confirmarExclusao(produto: Produto): void {
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          titulo: 'Excluir produto',
          mensagem: `Deseja excluir "${produto.nome}"? Esta ação não pode ser desfeita.`,
          textoConfirmar: 'Excluir',
        },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.produtoService.remover(produto.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.produtos.update((lista) => lista.filter((p) => p.id !== produto.id));
          this.snackBar.open('Produto excluído.', 'Fechar', { duration: 3000 });
        },
        // O interceptor já exibe o erro; recarrega para refletir o estado real da API.
        error: () => this.carregar(),
      });
  }
}

function ordenar(produtos: Produto[], { active, direction }: Sort): Produto[] {
  if (!active || !direction) {
    return produtos;
  }
  const coluna = active as ColunaOrdenavel;
  const fator = direction === 'asc' ? 1 : -1;
  return [...produtos].sort((a, b) => {
    const [x, y] = [a[coluna], b[coluna]];
    const comparacao =
      typeof x === 'string' ? x.localeCompare(y as string, 'pt-BR') : x - (y as number);
    return comparacao * fator;
  });
}
