import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, filter, fromEvent, merge, switchMap, timer } from 'rxjs';
import { ICONES_DE_NOTIFICACAO, Notificacao, NotificacaoService } from './notificacao.service';

const INTERVALO_MS = 60_000;

/**
 * Sino da barra superior: consulta a quantidade de não lidas a cada minuto (e ao voltar para a aba) e,
 * ao abrir, mostra as notificações mais recentes.
 */
@Component({
  selector: 'app-sino-notificacoes',
  imports: [DatePipe, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, RouterLink],
  template: `
    <button
      mat-icon-button
      [matMenuTriggerFor]="painel"
      (menuOpened)="abrir()"
      matTooltip="Notificações"
      [attr.aria-label]="naoLidas() ? naoLidas() + ' notificações não lidas' : 'Notificações'"
    >
      <mat-icon
        [matBadge]="naoLidas() > 99 ? '99+' : naoLidas()"
        [matBadgeHidden]="!naoLidas()"
        matBadgeColor="warn"
        matBadgeSize="small"
        aria-hidden="false"
      >
        notifications
      </mat-icon>
    </button>
    <mat-menu #painel="matMenu" xPosition="before" class="menu-notificacoes">
      <div class="topo" (click)="$event.stopPropagation()">
        <strong>Notificações</strong>
        <button mat-button type="button" [disabled]="!naoLidas()" (click)="marcarTodas()">Marcar todas como lidas</button>
      </div>
      @if (itens() === null) {
        <p class="vazio">Carregando...</p>
      } @else if (itens()!.length === 0) {
        <p class="vazio">Nenhuma notificação por aqui.</p>
      } @else {
        @for (item of itens(); track item.id) {
          <button mat-menu-item class="item" [class.nao-lida]="!item.lidaEm" (click)="abrirNotificacao(item)">
            <mat-icon>{{ icones[item.tipo] }}</mat-icon>
            <span class="texto">
              <span class="titulo">{{ item.titulo }}</span>
              @if (item.mensagem) {
                <span class="mensagem">{{ item.mensagem }}</span>
              }
              <span class="quando">{{ item.criadoEm | date: 'dd/MM HH:mm' }}</span>
            </span>
          </button>
        }
      }
      <a mat-menu-item routerLink="/configuracoes/notificacoes">
        <mat-icon>tune</mat-icon>
        <span>Preferências de notificação</span>
      </a>
    </mat-menu>
  `,
  styles: `
    .topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 4px 8px 4px 16px;
    }

    .vazio {
      margin: 0;
      padding: 16px;
      color: var(--mat-sys-on-surface-variant);
    }

    .item {
      height: auto !important;
      min-height: 56px;
      padding-top: 8px !important;
      padding-bottom: 8px !important;

      &.nao-lida {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);

        .titulo {
          font-weight: 600;
        }
      }
    }

    .texto {
      display: flex;
      flex-direction: column;
      white-space: normal;
      line-height: 1.3;
    }

    .mensagem,
    .quando {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class SinoNotificacoes implements OnInit {
  private readonly service = inject(NotificacaoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icones = ICONES_DE_NOTIFICACAO;
  protected readonly naoLidas = signal(0);
  protected readonly itens = signal<Notificacao[] | null>(null);

  ngOnInit(): void {
    const voltouParaAba = fromEvent(document, 'visibilitychange').pipe(filter(() => !document.hidden));
    merge(timer(0, INTERVALO_MS).pipe(filter(() => !document.hidden)), voltouParaAba)
      .pipe(
        switchMap(() => this.service.naoLidas().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((total) => this.naoLidas.set(total));
  }

  protected abrir(): void {
    this.service
      .listar(0, 10)
      .pipe(catchError(() => EMPTY))
      .subscribe((pagina) => this.itens.set(pagina.conteudo));
  }

  protected marcarTodas(): void {
    this.service.marcarTodasLidas().subscribe(() => {
      this.naoLidas.set(0);
      const agora = new Date().toISOString();
      this.itens.update((lista) => (lista ?? []).map((n) => ({ ...n, lidaEm: n.lidaEm ?? agora })));
    });
  }

  protected abrirNotificacao(item: Notificacao): void {
    if (!item.lidaEm) {
      this.service.marcarLida(item.id).subscribe(() => this.naoLidas.update((n) => Math.max(0, n - 1)));
    }
    if (item.link) {
      this.router.navigateByUrl(item.link);
    }
  }
}
