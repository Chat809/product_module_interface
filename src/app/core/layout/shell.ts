import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Tema } from '../tema/tema.service';

interface ItemDeMenu {
  rota: string;
  rotulo: string;
  icone: string;
}

@Component({
  selector: 'app-shell',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  template: `
    <mat-toolbar class="toolbar">
      @if (celular()) {
        <button mat-icon-button aria-label="Abrir menu" (click)="menu.toggle()">
          <mat-icon>menu</mat-icon>
        </button>
      }
      <a routerLink="/dashboard" class="marca">
        <mat-icon>inventory_2</mat-icon>
        <span>Painel de Produtos</span>
      </a>
      <span class="espaco"></span>
      <button
        mat-icon-button
        (click)="tema.alternar()"
        [matTooltip]="tema.escuro() ? 'Usar tema claro' : 'Usar tema escuro'"
        [attr.aria-label]="tema.escuro() ? 'Usar tema claro' : 'Usar tema escuro'"
      >
        <mat-icon>{{ tema.escuro() ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>
      @if (auth.usuario(); as usuario) {
        <button
          mat-button
          class="usuario"
          [matMenuTriggerFor]="menuUsuario"
          [attr.aria-label]="'Conta de ' + usuario.nome"
        >
          <mat-icon>account_circle</mat-icon>
          @if (!celular()) {
            <span class="nome-usuario">{{ usuario.nome }}</span>
          }
        </button>
        <mat-menu #menuUsuario="matMenu" xPosition="before">
          <div class="conta" (click)="$event.stopPropagation()">
            <strong>{{ usuario.nome }}</strong>
            <span>{{ usuario.email }}</span>
            <span class="papel" [class.admin]="usuario.papel === 'ADMIN'">
              {{ usuario.papel === 'ADMIN' ? 'Administrador' : 'Usuário' }}
            </span>
          </div>
          <button mat-menu-item (click)="auth.sair()">
            <mat-icon>logout</mat-icon>
            <span>Sair</span>
          </button>
        </mat-menu>
      }
    </mat-toolbar>

    <mat-sidenav-container class="container">
      <mat-sidenav
        #menu
        class="menu"
        [mode]="celular() ? 'over' : 'side'"
        [opened]="!celular()"
        [fixedInViewport]="celular()"
        fixedTopGap="64"
      >
        <mat-nav-list>
          @for (item of itens(); track item.rota) {
            <a
              mat-list-item
              [routerLink]="item.rota"
              routerLinkActive
              #ativo="routerLinkActive"
              [activated]="ativo.isActive"
              (click)="celular() && menu.close()"
            >
              <mat-icon matListItemIcon>{{ item.icone }}</mat-icon>
              <span matListItemTitle>{{ item.rotulo }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <main class="conteudo">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .toolbar {
      position: relative;
      z-index: 2;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }

    .toolbar .mat-mdc-icon-button {
      color: inherit;
    }

    .marca {
      display: flex;
      align-items: center;
      gap: 8px;
      color: inherit;
      text-decoration: none;
    }

    .espaco {
      flex: 1;
    }

    .toolbar .usuario {
      color: inherit;
      margin-left: 4px;
    }

    .nome-usuario {
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .conta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);

      strong {
        font: var(--mat-sys-title-small);
        color: var(--mat-sys-on-surface);
      }
    }

    .papel {
      align-self: flex-start;
      margin-top: 6px;
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--mat-sys-surface-container-highest);
      font: var(--mat-sys-label-small);

      &.admin {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
    }

    .container {
      flex: 1;
    }

    .menu {
      width: 232px;
      padding-top: 8px;
      border-right: 1px solid var(--mat-sys-outline-variant);
    }

    .menu ::ng-deep .mat-drawer-inner-container {
      overflow-x: hidden;
    }

    .menu mat-nav-list {
      padding: 0 8px;
    }

    .menu a {
      border-radius: 999px;
      transition: background-color var(--app-transicao);
    }

    .conteudo {
      box-sizing: border-box;
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px clamp(16px, 3vw, 32px) 48px;
    }
  `,
})
export class Shell {
  protected readonly tema = inject(Tema);
  protected readonly auth = inject(AuthService);

  protected readonly itens = computed<ItemDeMenu[]>(() => [
    { rota: '/dashboard', rotulo: 'Dashboard', icone: 'dashboard' },
    { rota: '/produtos', rotulo: 'Produtos', icone: 'inventory_2' },
    ...(this.auth.ehAdmin() ? [{ rota: '/usuarios', rotulo: 'Usuários', icone: 'group' }] : []),
  ]);

  protected readonly celular = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((estado) => estado.matches)),
    { initialValue: false },
  );
}
