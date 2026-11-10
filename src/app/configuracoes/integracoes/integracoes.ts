import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { Integracao, WebhookService } from '../webhooks/webhook.service';

const ICONES: Record<string, string> = {
  Supabase: 'database',
  'Login com Google': 'login',
  'E-mail': 'mail',
  Webhooks: 'webhook',
};

/** Configurações > Integrações: situação dos serviços conectados, sem mostrar chaves. */
@Component({
  selector: 'app-integracoes',
  imports: [MatButtonModule, MatIconModule, RouterLink, Skeleton],
  template: `
    <header class="cabecalho">
      <h1>Integrações</h1>
      <p class="subtitulo">Serviços conectados ao painel. As chaves ficam só no servidor e nunca aparecem aqui.</p>
    </header>

    @if (integracoes() === null) {
      <app-skeleton [linhas]="4" />
    } @else {
      <div class="grade">
        @for (i of integracoes(); track i.nome) {
          <section class="cartao">
            <mat-icon class="icone">{{ icones[i.nome] ?? 'extension' }}</mat-icon>
            <div class="texto">
              <h2>{{ i.nome }}</h2>
              <p>{{ i.detalhe }}</p>
              @if (i.nome === 'Webhooks' && podeVerWebhooks) {
                <a mat-button routerLink="/configuracoes/webhooks">Configurar webhooks</a>
              }
            </div>
            <span class="situacao" [class.ativa]="i.ativa">{{ i.ativa ? 'Ativo' : 'Inativo' }}</span>
          </section>
        }
      </div>
    }
  `,
  styles: `
    .cabecalho {
      margin-bottom: 16px;

      h1 {
        margin: 0;
        font: var(--mat-sys-headline-small);
      }
    }

    .subtitulo {
      margin: 4px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .grade {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }

    .cartao {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    .icone {
      color: var(--mat-sys-primary);
    }

    .texto {
      flex: 1;

      h2 {
        margin: 0;
        font: var(--mat-sys-title-medium);
      }

      p {
        margin: 4px 0 0;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }

      a {
        margin: 8px 0 0 -12px;
      }
    }

    .situacao {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);

      &.ativa {
        background: #dcfce7;
        color: #166534;
      }
    }
  `,
})
export class Integracoes implements OnInit {
  private readonly service = inject(WebhookService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icones = ICONES;
  protected readonly podeVerWebhooks = inject(AuthService).podeAcessar('configuracoes/webhooks');
  protected readonly integracoes = signal<Integracao[] | null>(null);

  ngOnInit(): void {
    this.service
      .integracoes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (lista) => this.integracoes.set(lista), error: () => this.integracoes.set([]) });
  }
}
