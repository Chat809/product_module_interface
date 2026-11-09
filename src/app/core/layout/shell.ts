import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { SinoNotificacoes } from '../../notificacoes/sino-notificacoes';
import { PerfilService } from '../../perfil/perfil.service';
import { Avatar } from '../../shared/avatar/avatar';
import { ROTULOS_PAPEL, descreverAcessos } from '../auth/acessos';
import { Modulo, Usuario } from '../auth/auth.model';
import { AuthService } from '../auth/auth.service';
import { Tema } from '../tema/tema.service';

@Component({
  selector: 'app-shell',
  imports: [
    Avatar,
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
    SinoNotificacoes,
  ],
  template: `
    <mat-toolbar class="toolbar">
      @if (celular()) {
        <button mat-icon-button aria-label="Abrir menu" (click)="menu.toggle()">
          <mat-icon>menu</mat-icon>
        </button>
      }
      <a [routerLink]="auth.rotaInicial()" class="marca">
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
      <app-sino-notificacoes />
      @if (auth.usuario(); as usuario) {
        <button
          mat-button
          class="usuario"
          [matMenuTriggerFor]="menuUsuario"
          [attr.aria-label]="'Conta de ' + usuario.nome"
        >
          <span class="conta-botao">
            <app-avatar [nome]="usuario.nome" [url]="usuario.avatarUrl" [tamanho]="28" />
            @if (!celular()) {
              <span class="nome-usuario">{{ usuario.nome }}</span>
            }
          </span>
        </button>
        <mat-menu #menuUsuario="matMenu" xPosition="before">
          <div class="conta" (click)="$event.stopPropagation()">
            <strong>{{ usuario.nome }}</strong>
            <span>{{ usuario.email }}</span>
            @if (cargoEDepartamento(usuario); as trabalho) {
              <span>{{ trabalho }}</span>
            }
            <span class="papel" [class.admin]="usuario.papel === 'ADMIN'">
              {{ rotulosPapel[usuario.papel] }}
            </span>
            <span class="acessos">Acessos: {{ descreverAcessos(usuario) }}</span>
          </div>
          <a mat-menu-item routerLink="/perfil">
            <mat-icon>person</mat-icon>
            <span>Meu perfil</span>
          </a>
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
          @for (modulo of auth.menu(); track modulo.chave) {
            <button
              type="button"
              class="grupo"
              [class.atual]="moduloAtual() === modulo.chave"
              [attr.aria-expanded]="aberto(modulo.chave)"
              (click)="alternar(modulo.chave)"
            >
              <mat-icon>{{ modulo.icone }}</mat-icon>
              <span class="grupo-rotulo">{{ modulo.rotulo }}</span>
              <mat-icon class="seta">{{ aberto(modulo.chave) ? 'expand_less' : 'expand_more' }}</mat-icon>
            </button>
            @if (aberto(modulo.chave)) {
              @for (subaba of modulo.subabas; track subaba.chave) {
                <a
                  mat-list-item
                  class="subaba"
                  [routerLink]="subaba.rota"
                  routerLinkActive
                  #ativo="routerLinkActive"
                  [activated]="ativo.isActive"
                  (click)="celular() && menu.close()"
                >
                  <mat-icon matListItemIcon>{{ subaba.icone }}</mat-icon>
                  <span matListItemTitle>{{ subaba.rotulo }}</span>
                </a>
              }
            }
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

    .toolbar {
      gap: 4px;
    }

    .toolbar .usuario {
      height: 40px;
      padding: 0 12px 0 6px;
      border-radius: 999px;
      color: inherit;
    }

    .conta-botao {
      display: flex;
      align-items: center;
      gap: 8px;
      line-height: 1;
    }

    .nome-usuario {
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font: var(--mat-sys-label-large);
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

    .acessos {
      margin-top: 4px;
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

    .grupo {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      margin-top: 4px;
      padding: 10px 12px;
      border: 0;
      border-radius: 999px;
      background: none;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-large);
      text-align: left;
      cursor: pointer;
      transition: background-color var(--app-transicao);

      &:hover {
        background: var(--mat-sys-surface-container-high);
      }

      &.atual {
        color: var(--mat-sys-primary);
      }
    }

    .grupo-rotulo {
      flex: 1;
    }

    .seta {
      color: var(--mat-sys-on-surface-variant);
    }

    .menu a.subaba {
      height: 40px;
      padding-left: 28px;
    }

    .conteudo {
      box-sizing: border-box;
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px clamp(16px, 3vw, 32px) 48px;
    }
  `,
})
export class Shell implements OnInit {
  protected readonly tema = inject(Tema);
  protected readonly auth = inject(AuthService);
  private readonly perfilService = inject(PerfilService);
  protected readonly descreverAcessos = descreverAcessos;
  protected readonly rotulosPapel = ROTULOS_PAPEL;

  /** Traz foto, nome, cargo e departamento atuais para o topo; se falhar, o painel segue com os dados da sessão. */
  ngOnInit(): void {
    this.perfilService.buscar(true).subscribe({
      next: ({ telefone, bio, ...usuario }) => this.auth.atualizarUsuario(usuario),
      error: () => undefined,
    });
  }

  protected cargoEDepartamento(usuario: Usuario): string {
    return [usuario.funcao, usuario.departamento].filter(Boolean).join(' · ');
  }

  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
      startWith(inject(Router).url),
    ),
    { initialValue: '' },
  );

  /** Módulo da rota atual, que fica sempre aberto no menu. */
  protected readonly moduloAtual = computed(() => this.url().split(/[/?#]/)[1] ?? '');
  private readonly gruposAbertos = signal<ReadonlySet<string>>(new Set());

  protected aberto(modulo: Modulo): boolean {
    return this.gruposAbertos().has(modulo) !== (this.moduloAtual() === modulo);
  }

  protected alternar(modulo: Modulo): void {
    this.gruposAbertos.update((abertos) => {
      const novo = new Set(abertos);
      if (novo.has(modulo)) {
        novo.delete(modulo);
      } else {
        novo.add(modulo);
      }
      return novo;
    });
  }

  protected readonly celular = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((estado) => estado.matches)),
    { initialValue: false },
  );
}
