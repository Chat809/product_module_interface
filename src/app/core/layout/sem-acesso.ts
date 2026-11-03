import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../auth/auth.service';

/** Destino de quem entrou mas não tem nenhum módulo liberado. */
@Component({
  selector: 'app-sem-acesso',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <section class="estado">
      <mat-icon>lock</mat-icon>
      <h1>Nenhum módulo liberado</h1>
      <p>
        Sua conta ainda não tem acesso a nenhuma área do painel. Peça a um administrador para liberar os
        módulos de que você precisa e depois entre novamente.
      </p>
      <button mat-stroked-button (click)="auth.sair()">
        <mat-icon>logout</mat-icon>
        Sair
      </button>
    </section>
  `,
  styles: `
    .estado {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      max-width: 480px;
      margin: 64px auto;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }

    mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    h1 {
      margin: 0;
      font: var(--mat-sys-headline-small);
      color: var(--mat-sys-on-surface);
    }

    p {
      margin: 0 0 8px;
    }
  `,
})
export class SemAcesso {
  protected readonly auth = inject(AuthService);
}
