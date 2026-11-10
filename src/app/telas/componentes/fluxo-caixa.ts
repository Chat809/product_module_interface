import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { data, hojeIso, somarDias } from '../formatos';

interface DiaDeCaixa {
  dia: string;
  entradasRealizadas: number;
  saidasRealizadas: number;
  entradasPrevistas: number;
  saidasPrevistas: number;
  saldoAcumulado: number;
}

interface SaldoDeConta {
  id: string;
  nome: string;
  saldoAtual: number;
}

/** Saldo de hoje por conta e projeção diária: o que já entrou/saiu e o que vence em contas a pagar e a receber. */
@Component({
  selector: 'app-fluxo-caixa',
  imports: [CurrencyPipe, FormsModule, MatButtonModule, MatButtonToggleModule, MatIconModule, Skeleton],
  template: `
    <header class="cabecalho">
      <div>
        <h1>Fluxo de caixa</h1>
        <p class="subtitulo">Realizado até hoje e previsto pelos vencimentos pendentes.</p>
      </div>
      <mat-button-toggle-group [value]="dias()" (change)="mudarPeriodo($event.value)" hideSingleSelectionIndicator aria-label="Período">
        <mat-button-toggle [value]="30">30 dias</mat-button-toggle>
        <mat-button-toggle [value]="60">60 dias</mat-button-toggle>
        <mat-button-toggle [value]="90">90 dias</mat-button-toggle>
      </mat-button-toggle-group>
    </header>

    @if (carregando()) {
      <app-skeleton [linhas]="6" />
    } @else {
      <section class="cartoes">
        <div class="cartao">
          <span>Saldo em contas</span>
          <strong>{{ saldoTotal() | currency: 'BRL' }}</strong>
        </div>
        <div class="cartao">
          <span>Entradas previstas</span>
          <strong class="positivo">{{ totais().entradas | currency: 'BRL' }}</strong>
        </div>
        <div class="cartao">
          <span>Saídas previstas</span>
          <strong class="negativo">{{ totais().saidas | currency: 'BRL' }}</strong>
        </div>
        <div class="cartao">
          <span>Saldo no fim do período</span>
          <strong [class.negativo]="saldoFinal() < 0">{{ saldoFinal() | currency: 'BRL' }}</strong>
        </div>
      </section>

      @if (contas().length) {
        <ul class="contas">
          @for (conta of contas(); track conta.id) {
            <li>
              <span>{{ conta.nome }}</span>
              <strong [class.negativo]="conta.saldoAtual < 0">{{ conta.saldoAtual | currency: 'BRL' }}</strong>
            </li>
          }
        </ul>
      }

      <div class="tabela">
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Entradas</th>
              <th>Saídas</th>
              <th>Saldo acumulado</th>
              <th class="barra-col"></th>
            </tr>
          </thead>
          <tbody>
            @for (d of diasComMovimento(); track d.dia) {
              <tr [class.futuro]="d.dia > hoje">
                <td>{{ formatarData(d.dia) }}</td>
                <td class="positivo">{{ d.entradasRealizadas + d.entradasPrevistas | currency: 'BRL' }}</td>
                <td class="negativo">{{ d.saidasRealizadas + d.saidasPrevistas | currency: 'BRL' }}</td>
                <td [class.negativo]="d.saldoAcumulado < 0">{{ d.saldoAcumulado | currency: 'BRL' }}</td>
                <td class="barra-col">
                  <span class="barra" [class.negativa]="d.saldoAcumulado < 0" [style.width.%]="largura(d.saldoAcumulado)"></span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="vazio">Nenhuma movimentação no período.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="dica">Linhas em itálico são previsões (vencimentos ainda pendentes).</p>
    }
  `,
  styles: `
    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
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

    .cartoes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .cartao {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;

      span {
        font: var(--mat-sys-label-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      strong {
        font: var(--mat-sys-title-large);
      }
    }

    .contas {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;
      margin: 0 0 16px;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        gap: 8px;
      }
    }

    .tabela {
      overflow-x: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 10px 16px;
      text-align: left;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      white-space: nowrap;
    }

    th {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .futuro td {
      font-style: italic;
    }

    .barra-col {
      width: 30%;
    }

    .barra {
      display: block;
      height: 8px;
      border-radius: 4px;
      background: var(--mat-sys-primary);

      &.negativa {
        background: var(--mat-sys-error);
      }
    }

    .positivo {
      color: var(--mat-sys-primary);
    }

    .negativo {
      color: var(--mat-sys-error);
    }

    .vazio,
    .dica {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class FluxoCaixa implements OnInit {
  private readonly supabase = inject(SupabaseService);

  protected readonly hoje = hojeIso();
  protected readonly dias = signal(30);
  protected readonly carregando = signal(true);
  protected readonly projecao = signal<DiaDeCaixa[]>([]);
  protected readonly contas = signal<SaldoDeConta[]>([]);
  protected readonly formatarData = data;

  protected readonly saldoTotal = computed(() => this.contas().reduce((s, c) => s + Number(c.saldoAtual), 0));
  protected readonly totais = computed(() =>
    this.projecao().reduce(
      (t, d) => ({ entradas: t.entradas + Number(d.entradasPrevistas), saidas: t.saidas + Number(d.saidasPrevistas) }),
      { entradas: 0, saidas: 0 },
    ),
  );
  protected readonly saldoFinal = computed(() => {
    const dias = this.projecao();
    return dias.length ? Number(dias[dias.length - 1].saldoAcumulado) : this.saldoTotal();
  });
  protected readonly diasComMovimento = computed(() =>
    this.projecao().filter((d) => d.entradasRealizadas || d.saidasRealizadas || d.entradasPrevistas || d.saidasPrevistas),
  );
  private readonly maiorSaldo = computed(() => Math.max(1, ...this.projecao().map((d) => Math.abs(Number(d.saldoAcumulado)))));

  ngOnInit(): void {
    this.carregar();
  }

  protected mudarPeriodo(dias: number): void {
    this.dias.set(dias);
    this.carregar();
  }

  protected largura(saldo: number): number {
    return Math.round((Math.abs(Number(saldo)) / this.maiorSaldo()) * 100);
  }

  private carregar(): void {
    this.carregando.set(true);
    forkJoin({
      projecao: this.supabase.rpc<DiaDeCaixa[]>('projecao_caixa', { p_inicio: this.hoje, p_fim: somarDias(this.hoje, this.dias()) }),
      contas: this.supabase.executar<SaldoDeConta[]>(() =>
        this.supabase.cliente.from('saldos_contas_bancarias').select('id, nome, saldo_atual').eq('ativo', true).order('nome'),
      ),
    }).subscribe({
      next: ({ projecao, contas }) => {
        this.projecao.set(projecao);
        this.contas.set(contas);
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }
}
