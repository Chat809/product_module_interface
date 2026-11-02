import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

const ESPERA_ANTES_DO_AVISO_MS = 3000;

/** Indicador de carregamento que avisa sobre a partida a frio da API no plano gratuito do Render. */
@Component({
  selector: 'app-loading',
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="loading">
      <mat-spinner diameter="40" />
      @if (demorando()) {
        <p>O servidor pode levar até 1 minuto para iniciar. Aguarde...</p>
      }
    </div>
  `,
  styles: `
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 48px 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class Loading implements OnInit, OnDestroy {
  protected readonly demorando = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.timer = setTimeout(() => this.demorando.set(true), ESPERA_ANTES_DO_AVISO_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
