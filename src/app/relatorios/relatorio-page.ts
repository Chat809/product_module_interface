import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { Notificacao } from '../core/feedback/notificacao.service';
import { Skeleton } from '../shared/skeleton/skeleton';
import { Periodo, Relatorio, RelatorioService, TipoRelatorio, formatar } from './relatorio.service';

const TITULOS: Record<TipoRelatorio, { titulo: string; subtitulo: string }> = {
  financeiro: { titulo: 'Relatório financeiro', subtitulo: 'Recebimentos, pagamentos e fluxo de caixa no período.' },
  comercial: { titulo: 'Relatório comercial', subtitulo: 'Leads, conversões e desempenho da equipe no período.' },
  estoque: { titulo: 'Relatório de estoque', subtitulo: 'Situação atual do estoque e retiradas dos últimos 30 dias.' },
  atendimento: { titulo: 'Relatório de atendimento', subtitulo: 'Reclamações abertas e resolvidas no período.' },
  dre: {
    titulo: 'DRE',
    subtitulo: 'Demonstrativo de resultado pelo plano de contas, com base na competência dos lançamentos.',
  },
  satisfacao: { titulo: 'Relatório de satisfação', subtitulo: 'NPS e notas das pesquisas respondidas no período.' },
};

function iso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Relatórios > (financeiro | dre | comercial | estoque | atendimento | satisfacao): o tipo vem do `data` da rota. */
@Component({
  selector: 'app-relatorio-page',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, Skeleton],
  templateUrl: './relatorio-page.html',
  styleUrl: './relatorio-page.scss',
})
export class RelatorioPage implements OnInit {
  private readonly service = inject(RelatorioService);
  private readonly notificacao = inject(Notificacao);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tipo = inject(ActivatedRoute).snapshot.data['tipo'] as TipoRelatorio;
  protected readonly textos = TITULOS[this.tipo];
  protected readonly usaPeriodo = this.tipo !== 'estoque';
  protected readonly formatar = formatar;
  protected readonly relatorio = signal<Relatorio | null>(null);
  protected readonly carregando = signal(false);
  protected readonly exportando = signal(false);
  protected inicio = iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected fim = iso(new Date());

  ngOnInit(): void {
    this.gerar();
  }

  protected atalho(dias: number | 'mes' | 'ano'): void {
    const hoje = new Date();
    if (dias === 'mes') {
      this.inicio = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    } else if (dias === 'ano') {
      this.inicio = iso(new Date(hoje.getFullYear(), 0, 1));
    } else {
      this.inicio = iso(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dias + 1));
    }
    this.fim = iso(hoje);
    this.gerar();
  }

  protected gerar(): void {
    if (!this.periodoValido()) {
      return;
    }
    this.carregando.set(true);
    this.service
      .gerar(this.tipo, this.periodo())
      .pipe(
        finalize(() => this.carregando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((relatorio) => this.relatorio.set(relatorio));
  }

  protected exportar(): void {
    if (!this.periodoValido()) {
      return;
    }
    this.exportando.set(true);
    this.service
      .csv(this.tipo, this.periodo())
      .pipe(
        finalize(() => this.exportando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((arquivo) => {
        const url = URL.createObjectURL(arquivo);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.usaPeriodo
          ? `relatorio-${this.tipo}-${this.inicio}-a-${this.fim}.csv`
          : `relatorio-${this.tipo}-${iso(new Date())}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      });
  }

  /** Largura da barra em relação ao maior valor do gráfico. */
  protected largura(valor: number, itens: { valor: number }[]): number {
    const maior = Math.max(...itens.map((i) => Math.abs(i.valor)), 0);
    return maior > 0 ? Math.max(2, (Math.abs(valor) / maior) * 100) : 0;
  }

  private periodo(): Periodo | null {
    return this.usaPeriodo ? { inicio: this.inicio, fim: this.fim } : null;
  }

  private periodoValido(): boolean {
    if (!this.usaPeriodo) {
      return true;
    }
    if (!this.inicio || !this.fim) {
      this.notificacao.aviso('Informe as datas inicial e final.');
      return false;
    }
    if (this.fim < this.inicio) {
      this.notificacao.aviso('A data final deve ser igual ou posterior à inicial.');
      return false;
    }
    return true;
  }
}
