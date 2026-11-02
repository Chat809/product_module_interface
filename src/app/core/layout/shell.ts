import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shell',
  imports: [MatToolbarModule, MatIconModule, RouterLink, RouterOutlet],
  template: `
    <mat-toolbar class="toolbar">
      <a routerLink="/produtos" class="marca">
        <mat-icon>inventory_2</mat-icon>
        <span>Painel de Produtos</span>
      </a>
    </mat-toolbar>

    <main class="conteudo">
      <router-outlet />
    </main>
  `,
  styles: `
    .toolbar {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }

    .marca {
      display: flex;
      align-items: center;
      gap: 8px;
      color: inherit;
      text-decoration: none;
    }

    .conteudo {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 16px;
    }
  `,
})
export class Shell {}
