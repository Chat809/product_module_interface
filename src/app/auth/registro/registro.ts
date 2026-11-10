import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { ProblemDetail } from '../../core/supabase/erros';
import { Tema } from '../../core/tema/tema.service';
import { Marca } from '../../shared/marca/marca';
import { BotaoGoogle } from '../botao-google/botao-google';

type Campo = 'nome' | 'email' | 'senha' | 'confirmacao';

/** Mensagens por validador, com as mesmas regras do RegistroRequestDTO da API. */
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
  senha: [
    ['required', 'A senha é obrigatória'],
    ['minlength', 'A senha deve ter pelo menos 6 caracteres'],
    ['maxlength', 'A senha deve ter no máximo 72 caracteres'],
  ],
  confirmacao: [
    ['required', 'Confirme a senha'],
    ['diferente', 'As senhas não conferem'],
  ],
};

@Component({
  selector: 'app-registro',
  imports: [
    BotaoGoogle,
    Marca,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './registro.html',
  styleUrl: '../auth.scss',
})
export class Registro {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificacao = inject(Notificacao);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly tema = inject(Tema);

  protected readonly enviando = signal(false);
  protected readonly senhaVisivel = signal(false);

  protected readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    senha: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    confirmacao: ['', [Validators.required, (controle: AbstractControl) => this.conferirSenha(controle)]],
  });

  constructor() {
    this.form.controls.senha.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.confirmacao.updateValueAndValidity());
  }

  protected registrar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nome, email, senha } = this.form.getRawValue();
    this.enviando.set(true);
    this.auth
      .registrar(nome.trim(), email.trim(), senha)
      .pipe(
        finalize(() => this.enviando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (usuario) => {
          this.notificacao.sucesso(`Conta criada. Bem-vindo, ${usuario.nome.split(' ')[0]}!`);
          this.router.navigateByUrl('/');
        },
        error: (erro: HttpErrorResponse) => {
          if (erro.status === 409) {
            this.form.controls.email.setErrors({
              api: 'Já existe uma conta com este e-mail. Entre com ela ou use outro e-mail.',
            });
          }
          (erro.error as ProblemDetail | null)?.erros?.forEach(({ campo, mensagem }) =>
            this.form.get(campo)?.setErrors({ api: mensagem }),
          );
          this.form.markAllAsTouched();
        },
      });
  }

  protected mensagemDeErro(campo: Campo): string {
    const erros = this.form.controls[campo].errors;
    if (!erros) {
      return '';
    }
    if (erros['api']) {
      return erros['api'];
    }
    return MENSAGENS[campo].find(([validador]) => erros[validador])?.[1] ?? 'Valor inválido';
  }

  private conferirSenha(controle: AbstractControl): ValidationErrors | null {
    const senha = this.form?.controls.senha.value;
    return controle.value && senha !== undefined && controle.value !== senha ? { diferente: true } : null;
  }
}
