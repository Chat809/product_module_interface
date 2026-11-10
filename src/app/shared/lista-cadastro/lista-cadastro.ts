import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EMPTY, Observable, Subject, catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { Pagina } from '../../produtos/produto.model';
import { Skeleton } from '../skeleton/skeleton';

export interface ColunaCadastro<T> {
  chave: string;
  rotulo: string;
  valor: (item: T) => string | number | null | undefined;
  /** Texto menor embaixo do valor, como o e-mail embaixo do nome. */
  detalhe?: (item: T) => string | null | undefined;
}

export interface FiltroCadastro {
  busca: string;
  /** `null` mostra ativos e inativos. */
  ativo: boolean | null;
}

export interface AcaoCadastro<T> {
  icone: string;
  rotulo: string;
  executar: (item: T) => void;
}

export type FonteCadastro<T> = (filtro: FiltroCadastro, pagina: number, tamanho: number) => Observable<Pagina<T>>;

/**
 * Lista paginada no banco com busca, filtro de situação (ativos, inativos, todos) e ações de editar e excluir.
 * Quem usa abre os diálogos e chama {@link recarregar} depois de gravar.
 */
@Component({
  selector: 'app-lista-cadastro',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatTableModule,
    MatTooltipModule,
    Skeleton,
  ],
  template: `
    <header class="cabecalho">
      <div>
        <h1>{{ titulo() }}</h1>
        @if (subtitulo()) {
          <p class="subtitulo">{{ subtitulo() }}</p>
        }
      </div>
      @if (podeEditar()) {
        <button mat-flat-button type="button" (click)="novo.emit()">
          <mat-icon>add</mat-icon>
          {{ rotuloNovo() }}
        </button>
      }
    </header>

    <section class="filtros">
      <mat-form-field appearance="outline" class="busca" subscriptSizing="dynamic">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>{{ rotuloBusca() }}</mat-label>
        <input matInput #campo [value]="filtro().busca" (input)="buscar(campo.value)" />
      </mat-form-field>
      @if (filtrarAtivos()) {
        <mat-button-toggle-group
          [value]="filtro().ativo"
          (change)="filtrarAtivo($event.value)"
          aria-label="Situação"
          hideSingleSelectionIndicator
        >
          <mat-button-toggle [value]="true">Ativos</mat-button-toggle>
          <mat-button-toggle [value]="false">Inativos</mat-button-toggle>
          <mat-button-toggle [value]="null">Todos</mat-button-toggle>
        </mat-button-toggle-group>
      }
      <ng-content />
    </section>

    @if (carregando() && itens().length === 0) {
      <app-skeleton [linhas]="5" />
    } @else if (itens().length === 0) {
      <div class="estado">
        <mat-icon>inbox</mat-icon>
        <p>{{ filtro().busca ? 'Nada encontrado para esta busca.' : vazio() }}</p>
      </div>
    } @else {
      <div class="tabela">
        <table mat-table [dataSource]="itens()">
          @for (coluna of colunas(); track coluna.chave) {
            <ng-container [matColumnDef]="coluna.chave">
              <th mat-header-cell *matHeaderCellDef>{{ coluna.rotulo }}</th>
              <td mat-cell *matCellDef="let item">
                <span class="valor">{{ coluna.valor(item) ?? '—' }}</span>
                @if (coluna.detalhe?.(item); as detalhe) {
                  <span class="detalhe">{{ detalhe }}</span>
                }
              </td>
            </ng-container>
          }
          <ng-container matColumnDef="situacao">
            <th mat-header-cell *matHeaderCellDef>Situação</th>
            <td mat-cell *matCellDef="let item">
              <span class="selo" [class.inativo]="item.ativo === false">{{ item.ativo === false ? 'Inativo' : 'Ativo' }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="acoes">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let item" class="acoes">
              @for (acao of acoesExtras(); track acao.rotulo) {
                <button
                  mat-icon-button
                  type="button"
                  [matTooltip]="acao.rotulo"
                  [attr.aria-label]="acao.rotulo"
                  (click)="acao.executar(item)"
                >
                  <mat-icon>{{ acao.icone }}</mat-icon>
                </button>
              }
              @if (podeAbrir()) {
                <button mat-icon-button type="button" matTooltip="Abrir" aria-label="Abrir" (click)="abrir.emit(item)">
                  <mat-icon>open_in_new</mat-icon>
                </button>
              }
              @if (podeEditar()) {
                <button mat-icon-button type="button" matTooltip="Editar" aria-label="Editar" (click)="editar.emit(item)">
                  <mat-icon>edit</mat-icon>
                </button>
                @if (podeExcluir()) {
                  <button mat-icon-button type="button" matTooltip="Excluir" aria-label="Excluir" (click)="excluir.emit(item)">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="nomesDasColunas()"></tr>
          <tr mat-row *matRowDef="let row; columns: nomesDasColunas()" (dblclick)="podeAbrir() ? abrir.emit(row) : editar.emit(row)"></tr>
        </table>
        <mat-paginator
          [length]="total()"
          [pageIndex]="pagina()"
          [pageSize]="tamanho()"
          [pageSizeOptions]="[10, 20, 50, 100]"
          (page)="mudarPagina($event)"
        />
      </div>
    }
  `,
  styles: `
    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;

      h1 {
        margin: 0;
        font: var(--mat-sys-headline-small);
      }
    }

    .subtitulo {
      margin: 4px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .filtros {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .busca {
      flex: 1 1 280px;
    }

    .tabela {
      overflow-x: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    table {
      width: 100%;
    }

    .valor {
      display: block;
    }

    .detalhe {
      display: block;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .selo {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font: var(--mat-sys-label-small);

      &.inativo {
        background: var(--mat-sys-surface-container-highest);
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .acoes {
      white-space: nowrap;
      text-align: right;
    }

    .estado {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 48px 16px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ListaCadastro<T> implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly titulo = input.required<string>();
  readonly subtitulo = input('');
  readonly rotuloNovo = input('Novo');
  readonly rotuloBusca = input('Buscar');
  readonly vazio = input('Nenhum cadastro ainda.');
  readonly colunas = input.required<ColunaCadastro<T>[]>();
  readonly fonte = input.required<FonteCadastro<T>>();
  readonly podeEditar = input(true);
  readonly podeExcluir = input(true);
  readonly podeAbrir = input(false);
  readonly filtrarAtivos = input(true);
  readonly acoesExtras = input<AcaoCadastro<T>[]>([]);

  readonly novo = output<void>();
  readonly abrir = output<T>();
  readonly editar = output<T>();
  readonly excluir = output<T>();

  protected readonly itens = signal<T[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(0);
  protected readonly tamanho = signal(20);
  protected readonly carregando = signal(false);
  protected readonly filtro = signal<FiltroCadastro>({ busca: '', ativo: true });

  protected readonly nomesDasColunas = computed(() => [
    ...this.colunas().map((c) => c.chave),
    ...(this.filtrarAtivos() ? ['situacao'] : []),
    'acoes',
  ]);

  private readonly pedidos = new Subject<void>();
  private readonly buscas = new Subject<string>();

  ngOnInit(): void {
    if (!this.filtrarAtivos()) {
      this.filtro.update((f) => ({ ...f, ativo: null }));
    }
    this.pedidos
      .pipe(
        switchMap(() => {
          this.carregando.set(true);
          return this.fonte()(this.filtro(), this.pagina(), this.tamanho()).pipe(
            catchError(() => EMPTY),
            finalize(() => this.carregando.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (pagina) => {
          this.itens.set(pagina.conteudo);
          this.total.set(pagina.totalElementos);
        },
      });
    this.buscas
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((busca) => {
        this.filtro.update((f) => ({ ...f, busca }));
        this.pagina.set(0);
        this.recarregar();
      });
    this.recarregar();
  }

  recarregar(): void {
    this.pedidos.next();
  }

  protected buscar(texto: string): void {
    this.buscas.next(texto.trim());
  }

  protected filtrarAtivo(ativo: boolean | null): void {
    this.filtro.update((f) => ({ ...f, ativo }));
    this.pagina.set(0);
    this.recarregar();
  }

  protected mudarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
    this.tamanho.set(evento.pageSize);
    this.recarregar();
  }
}
