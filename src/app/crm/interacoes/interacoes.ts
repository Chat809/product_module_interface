import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Observable, finalize } from 'rxjs';
import { UsuarioOpcao } from '../../demandas/demanda.model';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { Interacao, TIPOS_DE_INTERACAO, TipoInteracao } from '../crm.model';

/** Linha do tempo de contatos com um lead ou cliente, com o campo para registrar um novo. */
@Component({
  selector: 'app-interacoes',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    Skeleton,
  ],
  template: `
    @if (podeRegistrar()) {
      <form class="nova" (ngSubmit)="registrar()">
        <mat-button-toggle-group
          name="tipo"
          hideSingleSelectionIndicator
          aria-label="Tipo de interação"
          [(ngModel)]="tipo"
        >
          @for (item of tipos; track item[0]) {
            <mat-button-toggle [value]="item[0]" [attr.aria-label]="item[1].rotulo">
              <mat-icon>{{ item[1].icone }}</mat-icon>
              <span class="rotulo-tipo">{{ item[1].rotulo }}</span>
            </mat-button-toggle>
          }
        </mat-button-toggle-group>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>O que aconteceu?</mat-label>
          <textarea matInput name="descricao" rows="2" maxlength="2000" [(ngModel)]="descricao"></textarea>
        </mat-form-field>
        <div class="enviar">
          <button mat-flat-button type="submit" [disabled]="!descricao.trim() || salvando()">
            {{ salvando() ? 'Registrando...' : 'Registrar' }}
          </button>
        </div>
      </form>
    }

    @if (itens() === null) {
      <app-skeleton [linhas]="3" />
    } @else if (itens()!.length === 0) {
      <p class="vazio">Nenhuma interação registrada.</p>
    } @else {
      <ol class="linha-do-tempo">
        @for (item of itens(); track item.id) {
          <li>
            <mat-icon class="icone">{{ tiposPorChave[item.tipo].icone }}</mat-icon>
            <div>
              <p class="cabeca">
                <strong>{{ tiposPorChave[item.tipo].rotulo }}</strong>
                · {{ item.criadoEm | date: 'dd/MM/yyyy HH:mm' }}
                @if (item.registradoPor) {
                  · {{ pessoas().get(item.registradoPor)?.nome ?? 'Usuário removido' }}
                }
              </p>
              <p class="texto">{{ item.descricao }}</p>
            </div>
          </li>
        }
      </ol>
    }
  `,
  styles: `
    .nova {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .enviar {
      display: flex;
      justify-content: flex-end;
    }

    .linha-do-tempo {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }

    .icone {
      color: var(--mat-sys-primary);
    }

    .cabeca {
      margin: 0;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .texto {
      margin: 4px 0 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .vazio {
      color: var(--mat-sys-on-surface-variant);
    }

    @media (max-width: 600px) {
      .rotulo-tipo {
        display: none;
      }
    }
  `,
})
export class Interacoes implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly carregar = input.required<() => Observable<Interacao[]>>();
  readonly salvar = input.required<(tipo: TipoInteracao, descricao: string) => Observable<Interacao>>();
  readonly pessoas = input<Map<string, UsuarioOpcao>>(new Map());
  readonly podeRegistrar = input(true);

  protected readonly tipos = Object.entries(TIPOS_DE_INTERACAO) as [TipoInteracao, { rotulo: string; icone: string }][];
  protected readonly tiposPorChave = TIPOS_DE_INTERACAO;
  protected readonly itens = signal<Interacao[] | null>(null);
  protected readonly salvando = signal(false);
  protected tipo: TipoInteracao = 'LIGACAO';
  protected descricao = '';

  ngOnInit(): void {
    this.recarregar();
  }

  recarregar(): void {
    this.carregar()()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (itens) => this.itens.set(itens), error: () => this.itens.set([]) });
  }

  protected registrar(): void {
    const descricao = this.descricao.trim();
    if (!descricao) {
      return;
    }
    this.salvando.set(true);
    this.salvar()(this.tipo, descricao)
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((nova) => {
        this.itens.update((lista) => [nova, ...(lista ?? [])]);
        this.descricao = '';
      });
  }
}
