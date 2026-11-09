import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { ContaLista } from '../conta-lista/conta-lista';
import { ResumoFinanceiro, TipoConta } from '../financeiro.model';
import { FinanceiroService } from '../financeiro.service';

/** Subabas Contas a pagar e Contas a receber; o tipo vem do `data` da rota. */
@Component({
  selector: 'app-financeiro-page',
  imports: [CurrencyPipe, MatButtonModule, MatIconModule, ContaLista],
  templateUrl: './financeiro-page.html',
  styleUrl: './financeiro-page.scss',
})
export class FinanceiroPage implements OnInit {
  private readonly financeiroService = inject(FinanceiroService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tipo = inject(ActivatedRoute).snapshot.data['tipo'] as TipoConta;

  protected readonly resumo = signal<ResumoFinanceiro | null>(null);
  protected readonly erroNoResumo = signal(false);

  ngOnInit(): void {
    this.carregarResumo();
  }

  protected carregarResumo(): void {
    this.erroNoResumo.set(false);
    this.financeiroService
      .resumo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resumo) => this.resumo.set(resumo),
        error: () => this.erroNoResumo.set(true),
      });
  }
}
