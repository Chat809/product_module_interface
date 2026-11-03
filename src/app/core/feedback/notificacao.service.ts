import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Ponto único para exibir toasts, garantindo o mesmo padrão visual em todo o painel. */
@Injectable({ providedIn: 'root' })
export class Notificacao {
  private readonly snackBar = inject(MatSnackBar);

  sucesso(mensagem: string): void {
    this.snackBar.open(`✅ ${mensagem}`, 'Fechar', {
      duration: 3000,
      panelClass: 'toast-sucesso',
    });
  }

  erro(mensagem: string): void {
    this.snackBar.open(`⚠️ ${mensagem}`, 'Fechar', {
      duration: 5000,
      panelClass: 'toast-erro',
    });
  }
}
