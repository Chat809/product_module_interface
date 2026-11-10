import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { Usuario } from '../../core/auth/auth.model';
import { ProblemDetail } from '../../core/supabase/erros';
import { UsuarioService } from '../usuario.service';

/** As senhas ficam no Supabase só como hash: o admin não vê a atual, apenas define uma nova. */
@Component({
  selector: 'app-senha-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './senha-dialog.html',
  styleUrl: '../usuario-form/usuario-form.scss',
})
export class SenhaDialog {
  private readonly usuarioService = inject(UsuarioService);
  private readonly dialogRef = inject<MatDialogRef<SenhaDialog, boolean>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly usuario = inject<Usuario>(MAT_DIALOG_DATA);
  protected readonly salvando = signal(false);
  protected readonly senhaVisivel = signal(false);

  protected readonly form = this.fb.group({
    senha: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    confirmacao: ['', [Validators.required, (controle: AbstractControl) => this.conferirSenha(controle)]],
  });

  constructor() {
    this.form.controls.senha.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.confirmacao.updateValueAndValidity());
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.salvando.set(true);
    this.usuarioService
      .redefinirSenha(this.usuario.id, this.form.controls.senha.value)
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (erro: HttpErrorResponse) => {
          (erro.error as ProblemDetail | null)?.erros?.forEach(({ campo, mensagem }) =>
            this.form.get(campo)?.setErrors({ api: mensagem }),
          );
          this.form.markAllAsTouched();
        },
      });
  }

  protected mensagemDaSenha(): string {
    const erros = this.form.controls.senha.errors ?? {};
    if (erros['api']) {
      return erros['api'];
    }
    if (erros['required']) {
      return 'A senha é obrigatória';
    }
    return erros['minlength'] ? 'A senha deve ter pelo menos 6 caracteres' : 'A senha deve ter no máximo 72 caracteres';
  }

  private conferirSenha(controle: AbstractControl): ValidationErrors | null {
    const senha = this.form?.controls.senha.value;
    return controle.value && senha !== undefined && controle.value !== senha ? { diferente: true } : null;
  }
}
