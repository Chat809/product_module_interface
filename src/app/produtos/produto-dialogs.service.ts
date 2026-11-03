import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { MovimentacaoDialog, MovimentacaoDialogData } from './movimentacao-dialog/movimentacao-dialog';
import { ProdutoFormData, ProdutoFormDialog } from './produto-form/produto-form';
import { Produto } from './produto.model';

const LARGURA = { width: '560px', maxWidth: '95vw' };

/** Abre os modais de produto com a mesma configuração em qualquer tela. */
@Injectable({ providedIn: 'root' })
export class ProdutoDialogs {
  private readonly dialog = inject(MatDialog);

  /** Emite o produto salvo, ou `undefined` se o usuário cancelar. */
  formulario(produto?: Produto): Observable<Produto | undefined> {
    return this.dialog
      .open<ProdutoFormDialog, ProdutoFormData, Produto>(ProdutoFormDialog, { ...LARGURA, data: { produto } })
      .afterClosed();
  }

  /** Emite `true` quando uma movimentação é registrada. */
  movimentar(produto: Produto, tipo?: MovimentacaoDialogData['tipo']): Observable<boolean | undefined> {
    return this.dialog
      .open<MovimentacaoDialog, MovimentacaoDialogData, boolean>(MovimentacaoDialog, {
        ...LARGURA,
        data: { produto, tipo },
      })
      .afterClosed();
  }
}
