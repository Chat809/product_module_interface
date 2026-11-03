import { Component, OnDestroy, OnInit, computed, input, signal } from '@angular/core';

const ESPERA_ANTES_DO_AVISO_MS = 3000;

/** Placeholder de linhas animadas, com aviso sobre a partida a frio da API no plano gratuito do Render. */
@Component({
  selector: 'app-skeleton',
  template: `
    <div class="linhas" aria-busy="true" aria-label="Carregando">
      @for (linha of indices(); track linha) {
        <div class="linha">
          <div class="skeleton texto"></div>
          <div class="skeleton curto"></div>
          <div class="skeleton curto"></div>
        </div>
      }
    </div>
    @if (demorando()) {
      <p class="aviso">O servidor pode levar até 1 minuto para iniciar. Aguarde...</p>
    }
  `,
  styles: `
    .linhas {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--app-raio);
      overflow: hidden;
    }

    .linha {
      display: grid;
      grid-template-columns: 1fr 120px 120px;
      gap: 24px;
      padding: 20px 16px;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }

    .linha:first-child {
      border-top: none;
    }

    .skeleton {
      height: 14px;
    }

    .texto {
      width: 70%;
    }

    .aviso {
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class Skeleton implements OnInit, OnDestroy {
  readonly linhas = input(5);

  protected readonly indices = computed(() => Array.from({ length: this.linhas() }, (_, i) => i));
  protected readonly demorando = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.timer = setTimeout(() => this.demorando.set(true), ESPERA_ANTES_DO_AVISO_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
