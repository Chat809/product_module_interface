import { Component, computed, input } from '@angular/core';

/** Placeholder de linhas animadas enquanto a lista carrega. */
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
  `,
})
export class Skeleton {
  readonly linhas = input(5);

  protected readonly indices = computed(() => Array.from({ length: this.linhas() }, (_, i) => i));
}
