import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, filter, map, of, switchMap, tap } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { CamposExtrasService, camposDeCadastro, juntarExtras, valoresDosExtras } from '../campos-extras/campos-extras.service';
import { ConfirmDialog, ConfirmDialogData } from '../confirm-dialog/confirm-dialog';
import { FormularioCadastro, FormularioCadastroData } from './formulario-cadastro';

/** Abre o formulário genérico de cadastro e a confirmação de exclusão, com os avisos de sucesso. */
@Injectable({ providedIn: 'root' })
export class DialogosCadastro {
  private readonly dialog = inject(MatDialog);
  private readonly notificacao = inject(Notificacao);
  private readonly camposExtras = inject(CamposExtrasService);

  /** Emite o registro salvo; fechar sem salvar não emite nada. */
  formulario<T>(data: FormularioCadastroData<T>, mensagemDeSucesso: string): Observable<T> {
    return this.comExtras(data).pipe(
      switchMap((completo) =>
        this.dialog
          .open<FormularioCadastro<T>, FormularioCadastroData<T>, T>(FormularioCadastro, {
            data: completo,
            width: '680px',
            maxWidth: '95vw',
          })
          .afterClosed(),
      ),
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

  /** Acrescenta os campos extras da entidade e devolve os valores dentro de `extras` ao salvar. */
  private comExtras<T>(data: FormularioCadastroData<T>): Observable<FormularioCadastroData<T>> {
    if (!data.entidade) {
      return of(data);
    }
    return this.camposExtras.ativos(data.entidade).pipe(
      map((extras) => {
        if (!extras.length) {
          return data;
        }
        const anteriores = data.valores?.['extras'] as Record<string, unknown> | null | undefined;
        return {
          ...data,
          campos: [...data.campos, ...camposDeCadastro(extras)],
          valores: { ...(data.valores ?? {}), ...valoresDosExtras(extras, anteriores) },
          salvar: (valores: Record<string, unknown>) => data.salvar(juntarExtras(valores, anteriores)),
        };
      }),
    );
  }
}
