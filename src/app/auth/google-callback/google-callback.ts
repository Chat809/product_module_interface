import { Component, DestroyRef, OnInit, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';

/** Destino do retorno do Google: troca o código pela sessão e segue para o painel. */
@Component({
  selector: 'app-google-callback',
  imports: [MatProgressSpinnerModule],
  template: `
    <section class="cartao" role="status">
      <mat-spinner diameter="40" />
      <h1>Entrando com Google...</h1>
    </section>
  `,
  styleUrl: '../auth.scss',
  styles: `
    .cartao {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
    }
  `,
})
export class GoogleCallback implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificacao = inject(Notificacao);
  private readonly destroyRef = inject(DestroyRef);

  /** Parâmetros que o Supabase anexa ao endereço de retorno. */
  readonly code = input<string>();
  readonly error = input<string>();
  readonly descricaoDoErro = input<string>(undefined, { alias: 'error_description' });

  ngOnInit(): void {
    const erro = this.error();
    if (erro) {
      this.voltarAoLogin(
        erro === 'access_denied'
          ? 'Login com Google cancelado.'
          : `Não foi possível entrar com Google${this.descricaoDoErro() ? `: ${this.descricaoDoErro()}` : '.'}`,
      );
      return;
    }
    const codigo = this.code();
    if (!codigo) {
      this.voltarAoLogin('Retorno do Google sem código de autorização. Tente novamente.');
      return;
    }
    this.auth
      .concluirGoogle(codigo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ usuario, voltar }) => {
          this.notificacao.sucesso(`Olá, ${usuario.nome.split(' ')[0]}!`);
          this.router.navigateByUrl(voltar || this.auth.rotaInicial(), { replaceUrl: true });
        },
        // O motivo já foi avisado na tela.
        error: () => this.voltarAoLogin(),
      });
  }

  private voltarAoLogin(mensagem?: string): void {
    if (mensagem) {
      this.notificacao.erro(mensagem);
    }
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
