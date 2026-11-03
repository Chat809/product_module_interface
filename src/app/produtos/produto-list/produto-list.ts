import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, switchMap } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { DestaquePipe } from '../destaque.pipe';
import {
  ColunaOrdenavel,
  FiltroSituacao,
  Ordenacao,
  SituacaoEstoque,
  filtrar,
  ordenar,
  situacaoDoEstoque,
  termosDaBusca,
} from '../produto-filtro';
import { ProdutoDialogs } from '../produto-dialogs.service';
import { Produto } from '../produto.model';
import { ProdutoService } from '../produto.service';
import { ProdutoStore } from '../produto.store';

interface OpcaoDeOrdenacao {
  rotulo: string;
  valor: Ordenacao;
}

const ORDENACAO_PADRAO: Ordenacao = { coluna: 'nome', direcao: 'asc' };

@Component({
  selector: 'app-produto-list',
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    DestaquePipe,
    Skeleton,
  ],
  templateUrl: './produto-list.html',
  styleUrl: './produto-list.scss',
})
export class ProdutoList implements OnInit {
  protected readonly store = inject(ProdutoStore);
  private readonly produtoService = inject(ProdutoService);
  private readonly dialogs = inject(ProdutoDialogs);
  private readonly dialog = inject(MatDialog);
  private readonly notificacao = inject(Notificacao);

  protected readonly colunas = ['nome', 'preco', 'quantidadeEmEstoque', 'atualizadoEm', 'acoes'];
  protected readonly opcoesDeOrdenacao: OpcaoDeOrdenacao[] = [
    { rotulo: 'Nome (A–Z)', valor: { coluna: 'nome', direcao: 'asc' } },
    { rotulo: 'Nome (Z–A)', valor: { coluna: 'nome', direcao: 'desc' } },
    { rotulo: 'Menor preço', valor: { coluna: 'preco', direcao: 'asc' } },
    { rotulo: 'Maior preço', valor: { coluna: 'preco', direcao: 'desc' } },
    { rotulo: 'Menor estoque', valor: { coluna: 'quantidadeEmEstoque', direcao: 'asc' } },
    { rotulo: 'Maior estoque', valor: { coluna: 'quantidadeEmEstoque', direcao: 'desc' } },
    { rotulo: 'Atualizados recentemente', valor: { coluna: 'atualizadoEm', direcao: 'desc' } },
  ];
  protected readonly rotulosSituacao: Record<SituacaoEstoque, string> = {
    disponivel: 'Em estoque',
    baixo: 'Estoque baixo',
    esgotado: 'Esgotado',
  };
  protected readonly filtrosSituacao: FiltroSituacao[] = ['todos', 'disponivel', 'baixo', 'esgotado'];

  protected readonly busca = signal('');
  protected readonly situacao = signal<FiltroSituacao>('todos');
  protected readonly ordenacao = signal<Ordenacao>(ORDENACAO_PADRAO);
  protected readonly pagina = signal(0);
  protected readonly tamanhoPagina = signal(10);

  protected readonly termos = computed(() => termosDaBusca(this.busca()));

  /** Resultado da busca antes do filtro de situação, base das contagens dos chips. */
  private readonly encontrados = computed(() =>
    filtrar(this.store.indice(), this.termos(), 'todos', this.store.limiteEstoqueBaixo()),
  );

  protected readonly contagens = computed(() => {
    const limite = this.store.limiteEstoqueBaixo();
    const contagem: Record<FiltroSituacao, number> = { todos: 0, disponivel: 0, baixo: 0, esgotado: 0 };
    for (const produto of this.encontrados()) {
      contagem.todos++;
      contagem[situacaoDoEstoque(produto.quantidadeEmEstoque, limite)]++;
    }
    return contagem;
  });

  protected readonly resultado = computed(() => {
    const limite = this.store.limiteEstoqueBaixo();
    const situacao = this.situacao();
    const filtrados =
      situacao === 'todos'
        ? this.encontrados()
        : this.encontrados().filter((p) => situacaoDoEstoque(p.quantidadeEmEstoque, limite) === situacao);
    return ordenar(filtrados, this.ordenacao());
  });

  protected readonly paginaAtual = computed(() => {
    const inicio = this.pagina() * this.tamanhoPagina();
    return this.resultado().slice(inicio, inicio + this.tamanhoPagina());
  });

  ngOnInit(): void {
    this.store.carregar();
  }

  protected situacaoDe(produto: Produto): SituacaoEstoque {
    return situacaoDoEstoque(produto.quantidadeEmEstoque, this.store.limiteEstoqueBaixo());
  }

  protected rotuloDoFiltro(filtro: FiltroSituacao): string {
    return filtro === 'todos' ? 'Todos' : this.rotulosSituacao[filtro];
  }

  protected buscar(texto: string): void {
    this.busca.set(texto);
    this.pagina.set(0);
  }

  protected filtrarPorSituacao(situacao: FiltroSituacao | undefined): void {
    this.situacao.set(situacao ?? 'todos');
    this.pagina.set(0);
  }

  protected ordenarPor(ordenacao: Ordenacao): void {
    this.ordenacao.set(ordenacao);
    this.pagina.set(0);
  }

  protected ordenarPeloCabecalho({ active, direction }: Sort): void {
    this.ordenarPor(direction ? { coluna: active as ColunaOrdenavel, direcao: direction } : ORDENACAO_PADRAO);
  }

  protected mudarPagina({ pageIndex, pageSize }: PageEvent): void {
    this.pagina.set(pageIndex);
    this.tamanhoPagina.set(pageSize);
  }

  protected mesmaOrdenacao = (a: Ordenacao, b: Ordenacao): boolean =>
    a.coluna === b.coluna && a.direcao === b.direcao;

  protected limparFiltros(): void {
    this.busca.set('');
    this.situacao.set('todos');
    this.pagina.set(0);
  }

  protected novo(): void {
    this.dialogs.formulario().subscribe();
  }

  protected editar(produto: Produto): void {
    this.dialogs.formulario(produto).subscribe();
  }

  protected movimentar(produto: Produto): void {
    this.dialogs.movimentar(produto).subscribe();
  }

  protected confirmarExclusao(produto: Produto): void {
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          titulo: 'Excluir produto',
          mensagem: `Deseja excluir "${produto.nome}" e todo o seu histórico de estoque? Esta ação não pode ser desfeita.`,
          textoConfirmar: 'Excluir',
        },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.produtoService.remover(produto.id)),
      )
      .subscribe({
        next: () => {
          this.store.remover(produto.id);
          this.notificacao.sucesso(`"${produto.nome}" excluído.`);
        },
        error: () => this.store.carregar(true),
      });
  }
}
