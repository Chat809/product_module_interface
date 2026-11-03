import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { ACESSO_TOTAL, MODULOS } from '../../core/auth/acessos';
import { Modulo, Papel, Usuario } from '../../core/auth/auth.model';
import { ProblemDetail } from '../../core/http/error.interceptor';
import { UsuarioService } from '../usuario.service';

export interface UsuarioFormData {
  usuario: Usuario;
  /** O admin não pode tirar de si mesmo o papel de administrador. */
  ehVoce: boolean;
}

export const ROTULOS_PAPEL: Record<Papel, string> = {
  ADMIN: 'Administrador',
  USUARIO: 'Usuário',
};

type Campo = 'nome' | 'email';

const MENSAGENS: Record<Campo, [validador: string, mensagem: string][]> = {
  nome: [
    ['required', 'O nome é obrigatório'],
    ['pattern', 'O nome é obrigatório'],
    ['maxlength', 'O nome deve ter no máximo 100 caracteres'],
  ],
  email: [
    ['required', 'O e-mail é obrigatório'],
    ['email', 'Informe um e-mail válido'],
    ['maxlength', 'O e-mail deve ter no máximo 254 caracteres'],
  ],
};

@Component({
  selector: 'app-usuario-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './usuario-form.html',
  styleUrl: './usuario-form.scss',
})
export class UsuarioFormDialog {
  private readonly usuarioService = inject(UsuarioService);
  private readonly dialogRef = inject<MatDialogRef<UsuarioFormDialog, Usuario>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly data = inject<UsuarioFormData>(MAT_DIALOG_DATA);

  protected readonly usuario = this.data.usuario;
  protected readonly ehVoce = this.data.ehVoce;
  protected readonly papeis: Papel[] = ['USUARIO', 'ADMIN'];
  protected readonly rotulos = ROTULOS_PAPEL;
  /** O módulo de usuários não entra na lista: ele vem do papel ADMIN. */
  protected readonly modulos = MODULOS.filter((m) => !m.somenteAdmin);
  protected readonly salvando = signal(false);

  protected readonly form = this.fb.group({
    nome: [this.usuario.nome, [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    email: [this.usuario.email, [Validators.required, Validators.email, Validators.maxLength(254)]],
    papel: [{ value: this.usuario.papel, disabled: this.ehVoce }],
    total: [this.usuario.acessos.includes(ACESSO_TOTAL)],
    modulos: this.fb.group(
      Object.fromEntries(this.modulos.map((m) => [m.chave, this.usuario.acessos.includes(m.chave)])) as Record<
        Modulo,
        boolean
      >,
    ),
  });

  protected readonly papel = toSignal(this.form.controls.papel.valueChanges, {
    initialValue: this.usuario.papel,
  });
  protected readonly total = toSignal(this.form.controls.total.valueChanges, {
    initialValue: this.form.controls.total.value,
  });

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valor = this.form.getRawValue();
    this.salvando.set(true);
    this.usuarioService
      .atualizar(this.usuario.id, {
        nome: valor.nome.trim(),
        email: valor.email.trim(),
        papel: valor.papel,
        acessos: this.acessosEscolhidos(),
      })
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (salvo) => this.dialogRef.close(salvo),
        error: (erro: HttpErrorResponse) => this.tratarErro(erro),
      });
  }

  protected mensagemDeErro(campo: Campo): string {
    const erros = this.form.controls[campo].errors;
    if (!erros) {
      return '';
    }
    return erros['api'] ?? MENSAGENS[campo].find(([validador]) => erros[validador])?.[1] ?? 'Valor inválido';
  }

  /** Mesma forma que a API grava: `['*']` ou os módulos marcados, na ordem do menu. */
  private acessosEscolhidos(): string[] {
    const { papel, total, modulos } = this.form.getRawValue();
    if (papel === 'ADMIN' || total) {
      return [ACESSO_TOTAL];
    }
    return this.modulos.filter((m) => modulos[m.chave]).map((m) => m.chave);
  }

  private tratarErro(erro: HttpErrorResponse): void {
    if (erro.status === 409) {
      this.form.controls.email.setErrors({ api: 'Este e-mail já pertence a outra conta' });
    }
    (erro.error as ProblemDetail | null)?.erros?.forEach(({ campo, mensagem }) =>
      this.form.get(campo)?.setErrors({ api: mensagem }),
    );
    this.form.markAllAsTouched();
  }
}
