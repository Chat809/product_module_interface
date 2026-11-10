import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, concat, defer, filter, finalize, forkJoin, last, map, of } from 'rxjs';
import { paraSnake } from '../core/supabase/caixa';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Skeleton } from '../shared/skeleton/skeleton';
import { OpcoesService } from './opcoes.service';
import { FonteDeOpcoes, OpcaoTela, Registro } from './tela.model';

export interface ColunaLinha {
  chave: string;
  rotulo: string;
  tipo?: 'texto' | 'numero' | 'select' | 'toggle' | 'cor';
  opcoes?: OpcaoTela[];
  fonte?: FonteDeOpcoes;
  obrigatorio?: boolean;
  /** Largura relativa na grade (padrão 1). */
  peso?: number;
  /** Ao escolher uma opção, preenche outros campos da linha (ex.: produto → descrição e preço). */
  aoEscolher?: (linha: Registro, opcao: OpcaoTela | undefined) => void;
}

export interface EditorDeLinhasData {
  titulo: string;
  subtitulo?: string;
  tabela: string;
  /** Coluna que liga a linha ao registro pai (ex.: `proposta_id`). */
  chaveDoPai: string;
  paiId: string;
  /** Valores gravados em toda linha além do pai (ex.: `{ tipoConta: 'PAGAR' }`). */
  fixos?: Registro;
  colunas: ColunaLinha[];
  /** Coluna de ordenação gravada com a posição da linha. */
  colunaDeOrdem?: string;
  novaLinha?: () => Registro;
  /** Resumo mostrado no rodapé (ex.: total dos itens). */
  resumo?: (linhas: Registro[]) => string;
  /** Mensagem de erro que impede salvar; `null` libera. */
  validar?: (linhas: Registro[]) => string | null;
  somenteLeitura?: boolean;
}

/** Edita as linhas filhas de um registro (itens, etapas, colunas, rateio) e grava as diferenças de uma vez. */
@Component({
  selector: 'app-editor-linhas',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    Skeleton,
  ],
  template: `
    <header class="cabecalho">
      <div>
        <h2 mat-dialog-title>{{ data.titulo }}</h2>
        @if (data.subtitulo) {
          <p class="subtitulo">{{ data.subtitulo }}</p>
        }
      </div>
      <button mat-icon-button type="button" aria-label="Fechar" mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </header>
    <mat-dialog-content>
      @if (linhas() === null) {
        <app-skeleton [linhas]="3" />
      } @else {
        <div class="grade" [style.grid-template-columns]="gradeCss">
          @for (coluna of colunas(); track coluna.chave) {
            <span class="titulo-coluna">{{ coluna.rotulo }}</span>
          }
          <span></span>
          @for (linha of linhas(); track linha; let i = $index) {
            @for (coluna of colunas(); track coluna.chave) {
              @switch (coluna.tipo ?? 'texto') {
                @case ('select') {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-select
                      [ngModel]="linha[coluna.chave]"
                      (ngModelChange)="escolher(linha, coluna, $event)"
                      [disabled]="!!data.somenteLeitura"
                      [attr.aria-label]="coluna.rotulo"
                    >
                      @if (!coluna.obrigatorio) {
                        <mat-option [value]="null">—</mat-option>
                      }
                      @for (opcao of coluna.opcoes ?? []; track $index) {
                        <mat-option [value]="opcao.valor">{{ opcao.rotulo }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                }
                @case ('toggle') {
                  <mat-slide-toggle
                    [(ngModel)]="linha[coluna.chave]"
                    (ngModelChange)="tocar()"
                    [disabled]="!!data.somenteLeitura"
                    [attr.aria-label]="coluna.rotulo"
                  />
                }
                @default {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <input
                      matInput
                      [type]="coluna.tipo === 'numero' ? 'number' : coluna.tipo === 'cor' ? 'color' : 'text'"
                      [(ngModel)]="linha[coluna.chave]"
                      (ngModelChange)="tocar()"
                      [readonly]="!!data.somenteLeitura"
                      [attr.aria-label]="coluna.rotulo"
                      [attr.step]="coluna.tipo === 'numero' ? 'any' : null"
                    />
                  </mat-form-field>
                }
              }
            }
            @if (!data.somenteLeitura) {
              <div class="botoes-linha">
                <button mat-icon-button type="button" matTooltip="Subir" aria-label="Subir" [disabled]="i === 0" (click)="mover(i, -1)">
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button mat-icon-button type="button" matTooltip="Remover" aria-label="Remover" (click)="remover(i)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            } @else {
              <span></span>
            }
          }
        </div>
        @if (!linhas()!.length) {
          <p class="vazio">Nenhuma linha ainda.</p>
        }
        @if (!data.somenteLeitura) {
          <button mat-stroked-button type="button" class="adicionar" (click)="adicionar()">
            <mat-icon>add</mat-icon>
            Adicionar linha
          </button>
        }
        @if (data.resumo) {
          <p class="resumo">{{ resumo() }}</p>
        }
        @if (erro()) {
          <p class="erro">{{ erro() }}</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ data.somenteLeitura ? 'Fechar' : 'Cancelar' }}</button>
      @if (!data.somenteLeitura) {
        <button mat-flat-button type="button" [disabled]="salvando() || linhas() === null" (click)="salvar()">
          {{ salvando() ? 'Salvando...' : 'Salvar' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .cabecalho {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-right: 12px;

      h2 {
        padding-bottom: 0;
      }
    }

    .subtitulo {
      margin: 0 24px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .grade {
      display: grid;
      gap: 8px;
      align-items: center;
      min-width: min(760px, 85vw);
      padding-top: 8px;
    }

    .titulo-coluna {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .botoes-linha {
      display: flex;
      white-space: nowrap;
    }

    .adicionar {
      margin-top: 12px;
    }

    .resumo {
      margin: 16px 0 0;
      text-align: right;
      font: var(--mat-sys-title-small);
    }

    .erro {
      color: var(--mat-sys-error);
    }

    .vazio {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class EditorLinhas implements OnInit {
  protected readonly data = inject<EditorDeLinhasData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<EditorLinhas, boolean>>(MatDialogRef);
  private readonly supabase = inject(SupabaseService);
  private readonly opcoes = inject(OpcoesService);

  protected readonly linhas = signal<Registro[] | null>(null);
  protected readonly colunas = signal<ColunaLinha[]>(this.data.colunas);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  private readonly versao = signal(0);
  private idsOriginais: string[] = [];

  protected readonly gradeCss = `${this.data.colunas.map((c) => `minmax(0, ${c.peso ?? 1}fr)`).join(' ')} auto`;
  protected readonly resumo = computed(() => {
    this.versao();
    return this.data.resumo?.(this.linhas() ?? []) ?? '';
  });

  ngOnInit(): void {
    const comFonte = this.data.colunas.filter((c) => c.fonte);
    const opcoes$ = comFonte.length ? forkJoin(comFonte.map((c) => this.opcoes.de(c.fonte!))) : of([] as OpcaoTela[][]);
    const linhas$ = this.supabase.executar<Registro[]>(() => {
      const consulta = this.supabase.cliente.from(this.data.tabela).select('*').eq(this.data.chaveDoPai, this.data.paiId);
      return this.data.colunaDeOrdem ? consulta.order(this.data.colunaDeOrdem) : consulta;
    });
    forkJoin([opcoes$, linhas$]).subscribe({
      next: ([listas, linhas]) => {
        const porChave = new Map(comFonte.map((c, i) => [c.chave, listas[i]]));
        this.colunas.set(this.data.colunas.map((c) => (porChave.has(c.chave) ? { ...c, opcoes: porChave.get(c.chave) } : c)));
        this.idsOriginais = linhas.map((l) => l['id']);
        this.linhas.set(linhas);
      },
      error: () => this.dialogRef.close(),
    });
  }

  protected tocar(): void {
    this.versao.update((v) => v + 1);
    this.erro.set(null);
  }

  protected escolher(linha: Registro, coluna: ColunaLinha, valor: unknown): void {
    linha[coluna.chave] = valor;
    coluna.aoEscolher?.(
      linha,
      coluna.opcoes?.find((o) => o.valor === valor),
    );
    this.tocar();
  }

  protected adicionar(): void {
    this.linhas.update((lista) => [...(lista ?? []), this.data.novaLinha?.() ?? {}]);
    this.tocar();
  }

  protected remover(indice: number): void {
    this.linhas.update((lista) => (lista ?? []).filter((_, i) => i !== indice));
    this.tocar();
  }

  protected mover(indice: number, passo: number): void {
    this.linhas.update((lista) => {
      const copia = [...(lista ?? [])];
      const [linha] = copia.splice(indice, 1);
      copia.splice(indice + passo, 0, linha);
      return copia;
    });
    this.tocar();
  }

  protected salvar(): void {
    const linhas = this.linhas() ?? [];
    const faltando = this.data.colunas.find((c) => c.obrigatorio && linhas.some((l) => l[c.chave] === null || l[c.chave] === undefined || l[c.chave] === ''));
    if (faltando) {
      this.erro.set(`Preencha "${faltando.rotulo}" em todas as linhas.`);
      return;
    }
    const problema = this.data.validar?.(linhas);
    if (problema) {
      this.erro.set(problema);
      return;
    }
    const presentes = new Set(linhas.map((l) => l['id']).filter(Boolean));
    const removidos = this.idsOriginais.filter((id) => !presentes.has(id));
    const montar = (linha: Registro, posicao: number) => {
      const dados: Record<string, unknown> = { ...this.data.fixos, [this.camel(this.data.chaveDoPai)]: this.data.paiId };
      for (const coluna of this.data.colunas) {
        const valor = linha[coluna.chave];
        dados[coluna.chave] = coluna.tipo === 'numero' && valor !== null && valor !== '' && valor !== undefined ? Number(valor) : (valor ?? null);
      }
      if (this.data.colunaDeOrdem) {
        dados[this.camel(this.data.colunaDeOrdem)] = posicao;
      }
      return dados;
    };
    const existentes = linhas.map((l, i) => [l, i] as const).filter(([l]) => l['id']);
    const novas = linhas.map((l, i) => [l, i] as const).filter(([l]) => !l['id']);
    const tabela = this.data.tabela;
    const passos: Observable<unknown>[] = [
      ...(removidos.length ? [this.supabase.executar(() => this.supabase.cliente.from(tabela).delete().in('id', removidos))] : []),
      ...existentes.map(([linha, i]) =>
        this.supabase.executar(() => this.supabase.cliente.from(tabela).update(paraSnake(montar(linha, i))).eq('id', linha['id'])),
      ),
      ...(novas.length
        ? [this.supabase.executar(() => this.supabase.cliente.from(tabela).insert(novas.map(([linha, i]) => paraSnake(montar(linha, i)))))]
        : []),
    ];
    if (!passos.length) {
      this.dialogRef.close(false);
      return;
    }
    this.salvando.set(true);
    concat(...passos.map((passo) => defer(() => passo)))
      .pipe(
        last(),
        map(() => true),
        finalize(() => this.salvando.set(false)),
      )
      .subscribe(() => this.dialogRef.close(true));
  }

  private camel(coluna: string): string {
    return coluna.replace(/_([a-z])/g, (_, letra: string) => letra.toUpperCase());
  }
}

/** Abre o editor; emite uma vez só quando algo foi gravado. */
export function editarLinhas(dialog: MatDialog, data: EditorDeLinhasData): Observable<true> {
  return dialog
    .open<EditorLinhas, EditorDeLinhasData, boolean>(EditorLinhas, { data, maxWidth: '96vw' })
    .afterClosed()
    .pipe(filter((gravou): gravou is true => gravou === true));
}
