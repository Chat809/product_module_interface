import { Component } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** Indicador de carregamento centralizado. */
@Component({
  selector: 'app-loading',
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="loading">
      <mat-spinner diameter="40" />
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
export class Loading {}
