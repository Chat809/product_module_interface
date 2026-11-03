import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TipoToast, Toast, ToastData } from './toast/toast';

const DURACAO_MS: Record<TipoToast, number> = {
  sucesso: 3000,
  info: 4000,
  aviso: 5000,
  erro: 6000,
};

/** Ponto único para exibir toasts, garantindo o mesmo padrão visual em todo o painel. */
@Injectable({ providedIn: 'root' })
export class Notificacao {
  private readonly snackBar = inject(MatSnackBar);

  sucesso(mensagem: string): void {
    this.exibir('sucesso', mensagem);
  }

  erro(mensagem: string): void {
    this.exibir('erro', mensagem);
  }

  aviso(mensagem: string): void {
    this.exibir('aviso', mensagem);
  }

  info(mensagem: string): void {
    this.exibir('info', mensagem);
  }

  private exibir(tipo: TipoToast, mensagem: string): void {
    this.snackBar.openFromComponent<Toast, ToastData>(Toast, {
      data: { tipo, mensagem },
      duration: DURACAO_MS[tipo],
      panelClass: `toast-${tipo}`,
    });
  }
}
