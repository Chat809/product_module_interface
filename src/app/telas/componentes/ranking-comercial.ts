import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { hojeIso } from '../formatos';

interface PosicaoNoRanking {
  usuarioId: string;
  nome: string;
  pedidos: number;
  valorFaturado: number;
  meta: number | null;
  percentualMeta: number | null;
  comissao: number;
}

/** Faturamento, meta e comissão de cada vendedor no mês escolhido. */
@Component({
  selector: 'app-ranking-comercial',
  imports: [CurrencyPipe, DecimalPipe, FormsModule, MatFormFieldModule, MatInputModule, Skeleton],
  template: `
    <header class="cabecalho">
      <div>
        <h1>Ranking de vendas</h1>
        <p class="subtitulo">Pedidos faturados no mês, comparados com a meta de cada vendedor.</p>
      </div>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Mês</mat-label>
        <input matInput type="month" [ngModel]="mes()" (ngModelChange)="mudarMes($event)" />
      </mat-form-field>
    </header>

    @if (posicoes() === null) {
      <app-skeleton [linhas]="5" />
    } @else if (!posicoes()!.length) {
      <p class="vazio">Nenhum pedido faturado neste mês.</p>
    } @else {
      <ol class="ranking">
        @for (p of posicoes(); track p.usuarioId; let i = $index) {
          <li>
            <span class="posicao">{{ i + 1 }}º</span>
            <div class="pessoa">
              <strong>{{ p.nome }}</strong>
              <span class="detalhe">{{ p.pedidos }} pedido(s) · comissão {{ p.comissao | currency: 'BRL' }}</span>
              @if (p.meta) {
                <div class="progresso" [attr.aria-label]="'Meta atingida: ' + (p.percentualMeta ?? 0) + '%'">
                  <span [style.width.%]="limitar(p.percentualMeta)" [class.batida]="(p.percentualMeta ?? 0) >= 100"></span>
                </div>
              }
            </div>
            <div class="valores">
              <strong>{{ p.valorFaturado | currency: 'BRL' }}</strong>
              @if (p.meta) {
                <span class="detalhe">{{ p.percentualMeta ?? 0 | number: '1.0-0' }}% de {{ p.meta | currency: 'BRL' }}</span>
              } @else {
                <span class="detalhe">Sem meta</span>
              }
            </div>
          </li>
        }
      </ol>
    }
  `,
  styles: `
    .cabecalho {
      display: flex;
      flex-wrap: wrap;
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

    .ranking {
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;

      li {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }

      li:last-child {
        border-bottom: 0;
      }
    }

    .posicao {
      font: var(--mat-sys-title-large);
      color: var(--mat-sys-primary);
      min-width: 40px;
    }

    .pessoa {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .valores {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .detalhe,
    .vazio {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .progresso {
      height: 6px;
      max-width: 320px;
      border-radius: 3px;
      background: var(--mat-sys-surface-container-highest);

      span {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: var(--mat-sys-primary);

        &.batida {
          background: var(--mat-sys-tertiary);
        }
      }
    }
  `,
})
export class RankingComercial implements OnInit {
  private readonly supabase = inject(SupabaseService);

  protected readonly mes = signal(hojeIso().slice(0, 7));
  protected readonly posicoes = signal<PosicaoNoRanking[] | null>(null);

  ngOnInit(): void {
    this.carregar();
  }

  protected mudarMes(mes: string): void {
    if (mes) {
      this.mes.set(mes);
      this.carregar();
    }
  }

  protected limitar(percentual: number | null): number {
    return Math.min(100, Math.max(0, Number(percentual ?? 0)));
  }

  private carregar(): void {
    this.posicoes.set(null);
    this.supabase.rpc<PosicaoNoRanking[]>('ranking_comercial', { p_periodo: `${this.mes()}-01` }).subscribe({
      next: (lista) => this.posicoes.set(lista),
      error: () => this.posicoes.set([]),
    });
  }
}
