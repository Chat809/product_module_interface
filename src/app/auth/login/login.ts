import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

@Component({
  selector: 'app-login',
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
  templateUrl: './login.html',
  styleUrl: '../auth.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificacao = inject(Notificacao);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tema = inject(Tema);

  /** Rota pedida antes do login, recebida como query param pelo authGuard. */
  readonly voltar = input<string>();

  protected readonly enviando = signal(false);
  protected readonly senhaVisivel = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    senha: ['', Validators.required],
  });

  protected entrar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, senha } = this.form.getRawValue();
    this.enviando.set(true);
    this.auth
      .entrar(email, senha)
      .pipe(
        finalize(() => this.enviando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (usuario) => {
          this.notificacao.sucesso(`Olá, ${usuario.nome.split(' ')[0]}!`);
          this.router.navigateByUrl(this.voltar() || '/');
        },
        error: (erro: HttpErrorResponse) => {
          (erro.error as ProblemDetail | null)?.erros?.forEach(({ campo, mensagem }) =>
            this.form.get(campo)?.setErrors({ api: mensagem }),
          );
          this.form.controls.senha.reset();
        },
      });
  }
}
