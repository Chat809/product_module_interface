import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import {
  ICONES_DE_NOTIFICACAO,
  NotificacaoService,
  PreferenciaNotificacao,
} from '../../notificacoes/notificacao.service';
import { Skeleton } from '../../shared/skeleton/skeleton';

/** Configurações > Notificações: cada pessoa escolhe o que quer receber. */
@Component({
  selector: 'app-preferencias-notificacao',
  imports: [MatButtonModule, MatIconModule, MatSlideToggleModule, Skeleton],
  template: `
    <header class="cabecalho">
      <h1>Notificações</h1>
      <p class="subtitulo">
        Escolha o que aparece no sino da barra superior. Os avisos de vencimento são gerados todo dia às 8h.
      </p>
    </header>

    @if (preferencias() === null) {
      <app-skeleton [linhas]="6" />
    } @else {
      @if (!emailDisponivel()) {
        <p class="aviso">
          <mat-icon>info</mat-icon>
          O envio por e-mail ainda não está habilitado no servidor. As escolhas de e-mail ficam guardadas e passam a valer
          quando um provedor for configurado.
        </p>
      }
      <div class="tabela">
        <div class="linha titulo">
          <span>Quando</span>
          <span>No painel</span>
          <span>Por e-mail</span>
        </div>
        @for (p of preferencias(); track p.tipo) {
          <div class="linha">
            <span class="descricao">
              <mat-icon>{{ icones[p.tipo] }}</mat-icon>
              {{ p.descricao }}
            </span>
            <mat-slide-toggle
              [checked]="p.noApp"
              (change)="alterar(p, 'noApp', $event.checked)"
              [attr.aria-label]="p.descricao + ' no painel'"
            />
            <mat-slide-toggle
              [checked]="p.porEmail"
              (change)="alterar(p, 'porEmail', $event.checked)"
              [attr.aria-label]="p.descricao + ' por e-mail'"
            />
          </div>
        }
      </div>
      <div class="acoes">
        <button mat-flat-button type="button" [disabled]="!alterado() || salvando()" (click)="salvar()">
          {{ salvando() ? 'Salvando...' : 'Salvar preferências' }}
        </button>
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

    .aviso {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px;
      border-radius: var(--app-raio);
      background: var(--mat-sys-surface-container-low);
      color: var(--mat-sys-on-surface-variant);
    }

    .tabela {
      max-width: 720px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    .linha {
      display: grid;
      grid-template-columns: 1fr 96px 96px;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);

      &:last-child {
        border-bottom: 0;
      }

      &.titulo {
        font: var(--mat-sys-label-medium);
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .descricao {
      display: flex;
      align-items: center;
      gap: 12px;

      mat-icon {
        color: var(--mat-sys-primary);
      }
    }

    .acoes {
      max-width: 720px;
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `,
})
export class PreferenciasNotificacaoPage implements OnInit {
  private readonly service = inject(NotificacaoService);
  private readonly notificacao = inject(Notificacao);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icones = ICONES_DE_NOTIFICACAO;
  protected readonly preferencias = signal<PreferenciaNotificacao[] | null>(null);
  protected readonly emailDisponivel = signal(false);
  protected readonly alterado = signal(false);
  protected readonly salvando = signal(false);

  ngOnInit(): void {
    this.service
      .preferencias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resposta) => {
        this.emailDisponivel.set(resposta.emailDisponivel);
        this.preferencias.set(resposta.preferencias);
      });
  }

  protected alterar(preferencia: PreferenciaNotificacao, campo: 'noApp' | 'porEmail', valor: boolean): void {
    this.preferencias.update((lista) =>
      (lista ?? []).map((p) => (p.tipo === preferencia.tipo ? { ...p, [campo]: valor } : p)),
    );
    this.alterado.set(true);
  }

  protected salvar(): void {
    this.salvando.set(true);
    this.service
      .salvarPreferencias(this.preferencias() ?? [])
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resposta) => {
        this.preferencias.set(resposta.preferencias);
        this.alterado.set(false);
        this.notificacao.sucesso('Preferências salvas.');
      });
  }
}
