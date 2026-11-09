import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, filter, map, switchMap, tap } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { ConfirmDialog, ConfirmDialogData } from '../confirm-dialog/confirm-dialog';
import { FormularioCadastro, FormularioCadastroData } from './formulario-cadastro';

/** Abre o formulário genérico de cadastro e a confirmação de exclusão, com os avisos de sucesso. */
@Injectable({ providedIn: 'root' })
export class DialogosCadastro {
  private readonly dialog = inject(MatDialog);
  private readonly notificacao = inject(Notificacao);

  /** Emite o registro salvo; fechar sem salvar não emite nada. */
  formulario<T>(data: FormularioCadastroData<T>, mensagemDeSucesso: string): Observable<T> {
    return this.dialog
      .open<FormularioCadastro<T>, FormularioCadastroData<T>, T>(FormularioCadastro, {
        data,
        width: '680px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .pipe(
        filter((salvo): salvo is T => salvo !== undefined && salvo !== null),
        tap(() => this.notificacao.sucesso(mensagemDeSucesso)),
      );
  }

  /** Pede confirmação, exclui e avisa; emite uma vez quando a exclusão termina. */
  excluir(descricao: string, exclusao: () => Observable<void>): Observable<void> {
    return this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          titulo: 'Excluir?',
          mensagem: `${descricao} será excluído(a) definitivamente.`,
          textoConfirmar: 'Excluir',
        },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => exclusao()),
        map(() => undefined),
        tap(() => this.notificacao.sucesso('Excluído.')),
      );
  }
}
