import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';

export type TipoToast = 'sucesso' | 'erro' | 'aviso' | 'info';

export interface ToastData {
  tipo: TipoToast;
  mensagem: string;
}

const EMOJIS: Record<TipoToast, string> = {
  sucesso: '✅',
  erro: '⚠️',
  aviso: '🔔',
  info: 'ℹ️',
};

@Component({
  selector: 'app-toast',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="toast" [attr.role]="data.tipo === 'erro' ? 'alert' : 'status'">
      <span class="emoji" aria-hidden="true">{{ emoji }}</span>
      <span class="mensagem">{{ data.mensagem }}</span>
      <button mat-icon-button class="fechar" aria-label="Fechar aviso" (click)="fechar()">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  styles: `
    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .emoji {
      font-size: 20px;
      line-height: 1;
    }

    .mensagem {
      flex: 1;
    }

    .fechar {
      color: inherit;
      margin: -8px -12px -8px 0;
    }
  `,
})
export class Toast {
  protected readonly data = inject<ToastData>(MAT_SNACK_BAR_DATA);
  private readonly ref = inject(MatSnackBarRef);

  protected readonly emoji = EMOJIS[this.data.tipo];

  protected fechar(): void {
    this.ref.dismiss();
  }
}
