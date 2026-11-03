import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { ContaLista } from '../conta-lista/conta-lista';
import { ResumoFinanceiro } from '../financeiro.model';
import { FinanceiroService } from '../financeiro.service';

@Component({
  selector: 'app-financeiro-page',
  imports: [CurrencyPipe, MatButtonModule, MatIconModule, MatTabsModule, ContaLista],
  templateUrl: './financeiro-page.html',
  styleUrl: './financeiro-page.scss',
})
export class FinanceiroPage implements OnInit {
  private readonly financeiroService = inject(FinanceiroService);
  private readonly destroyRef = inject(DestroyRef);

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
