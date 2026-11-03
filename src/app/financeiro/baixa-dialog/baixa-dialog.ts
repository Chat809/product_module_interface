import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { Conta, TIPOS_DE_CONTA, TipoConta, hojeIso } from '../financeiro.model';
import { FinanceiroService } from '../financeiro.service';

export interface BaixaDialogData {
  tipo: TipoConta;
  conta: Conta;
}

/** Registra o pagamento (a pagar) ou o recebimento (a receber). A API recusa datas futuras. */
@Component({
  selector: 'app-baixa-dialog',
  imports: [CurrencyPipe, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ dados.acaoBaixa }}</h2>
    <form [formGroup]="form" (ngSubmit)="confirmar()" novalidate>
      <mat-dialog-content class="conteudo">
        <p>
          <strong>{{ conta.descricao }}</strong> · {{ conta.pessoa }}<br />
          Líquido: <strong>{{ conta.valorLiquido | currency }}</strong>
        </p>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ dados.rotuloData }}</mat-label>
          <input matInput type="date" formControlName="data" [max]="hoje" cdkFocusInitial />
          @if (form.controls.data.hasError('required')) {
            <mat-error>Informe a data</mat-error>
          } @else {
            <mat-error>A data não pode ser futura</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="salvando()">
          {{ salvando() ? 'Salvando...' : 'Confirmar' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    p {
      margin: 0 0 8px;
      line-height: 1.6;
    }
  `,
})
export class BaixaDialog {
  private readonly financeiroService = inject(FinanceiroService);
  private readonly dialogRef = inject<MatDialogRef<BaixaDialog, Conta>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject<BaixaDialogData>(MAT_DIALOG_DATA);

  protected readonly conta = this.data.conta;
  protected readonly dados = TIPOS_DE_CONTA[this.data.tipo];
  protected readonly hoje = hojeIso();
  protected readonly salvando = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    data: [this.hoje, [Validators.required, (c: AbstractControl<string>) => (c.value > this.hoje ? { futura: true } : null)]],
  });

  protected confirmar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.salvando.set(true);
    this.financeiroService
      .baixar(this.data.tipo, this.conta.id, this.form.controls.data.value)
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((conta) => this.dialogRef.close(conta));
  }
}
