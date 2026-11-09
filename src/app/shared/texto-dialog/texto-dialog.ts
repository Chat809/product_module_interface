import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface TextoDialogData {
  titulo: string;
  mensagem?: string;
  rotulo: string;
  valor?: string | null;
  obrigatorio?: boolean;
  max?: number;
  textoConfirmar?: string;
}

/** Pede um texto (motivo, solução, comentário). Fecha com o texto aparado, ou sem valor ao cancelar. */
@Component({
  selector: 'app-texto-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <form (ngSubmit)="confirmar()" novalidate>
      <mat-dialog-content>
        @if (data.mensagem) {
          <p>{{ data.mensagem }}</p>
        }
        <mat-form-field appearance="outline" class="campo" subscriptSizing="dynamic">
          <mat-label>{{ data.rotulo }}</mat-label>
          <textarea matInput rows="4" [formControl]="texto" [attr.maxlength]="data.max ?? 2000" cdkFocusInitial></textarea>
          @if (texto.hasError('required') || texto.hasError('pattern')) {
            <mat-error>Preencha este campo</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit">{{ data.textoConfirmar ?? 'Confirmar' }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .campo {
      width: min(480px, 80vw);
    }
  `,
})
export class TextoDialog {
  protected readonly data = inject<TextoDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<TextoDialog, string>>(MatDialogRef);

  protected readonly texto = new FormControl(this.data.valor ?? '', {
    nonNullable: true,
    validators: [
      Validators.maxLength(this.data.max ?? 2000),
      ...(this.data.obrigatorio ? [Validators.required, Validators.pattern(/\S/)] : []),
    ],
  });

  protected confirmar(): void {
    if (this.texto.invalid) {
      this.texto.markAsTouched();
      return;
    }
    this.dialogRef.close(this.texto.value.trim());
  }
}
