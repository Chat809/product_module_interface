import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { Observable, of, switchMap } from 'rxjs';
import { SupabaseService } from '../../core/supabase/supabase.service';

export interface Marcador {
  id: string;
  nome: string;
  cor: string | null;
}

const CORES = ['#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#e53935', '#00897b', '#6d4c41', '#3949ab'];

/** Etiquetas livres de qualquer registro. Digitar um nome que não existe cria a etiqueta na hora. */
@Component({
  selector: 'app-seletor-marcadores',
  imports: [FormsModule, MatAutocompleteModule, MatChipsModule, MatFormFieldModule, MatIconModule],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
      <mat-label>Etiquetas</mat-label>
      <mat-chip-grid #grade aria-label="Etiquetas" [disabled]="!podeEditar()">
        @for (marcador of vinculados(); track marcador.id) {
          <mat-chip-row [style.--cor]="marcador.cor" (removed)="desvincular(marcador)">
            {{ marcador.nome }}
            @if (podeEditar()) {
              <button matChipRemove type="button" [attr.aria-label]="'Remover ' + marcador.nome">
                <mat-icon>cancel</mat-icon>
              </button>
            }
          </mat-chip-row>
        }
        <input
          name="novo"
          [placeholder]="podeEditar() ? 'Adicionar etiqueta...' : ''"
          [matChipInputFor]="grade"
          [matAutocomplete]="sugestoes"
          [(ngModel)]="texto"
          (matChipInputTokenEnd)="criarOuVincular()"
        />
      </mat-chip-grid>
      <mat-autocomplete #sugestoes="matAutocomplete" (optionSelected)="escolher($event)">
        @for (marcador of disponiveis(); track marcador.id) {
          <mat-option [value]="marcador">{{ marcador.nome }}</mat-option>
        }
      </mat-autocomplete>
    </mat-form-field>
  `,
  styles: `
    .campo {
      width: 100%;
      margin-top: 16px;
    }

    mat-chip-row[style*='--cor'] {
      --mat-chip-elevated-container-color: color-mix(in srgb, var(--cor) 18%, transparent);
      --mat-chip-outline-color: var(--cor);
    }
  `,
})
export class SeletorMarcadores implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly entidade = input.required<string>();
  readonly registroId = input.required<string>();
  readonly podeEditar = input(true);

  protected readonly todos = signal<Marcador[]>([]);
  protected readonly vinculados = signal<Marcador[]>([]);
  protected readonly filtro = signal('');
  protected get texto(): string {
    return this.filtro();
  }
  protected set texto(valor: string | Marcador) {
    this.filtro.set(typeof valor === 'string' ? valor : '');
  }

  protected readonly disponiveis = computed(() => {
    const usados = new Set(this.vinculados().map((m) => m.id));
    const termo = this.filtro().trim().toLowerCase();
    return this.todos().filter((m) => !usados.has(m.id) && (!termo || m.nome.toLowerCase().includes(termo)));
  });

  ngOnInit(): void {
    this.supabase
      .executar<Marcador[]>(() => this.supabase.cliente.from('marcadores').select('id, nome, cor').order('nome'), { silencioso: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (lista) => this.todos.set(lista), error: () => this.todos.set([]) });
    this.supabase
      .executar<{ marcador: Marcador }[]>(
        () =>
          this.supabase.cliente
            .from('marcadores_vinculos')
            .select('marcador:marcadores(id, nome, cor)')
            .eq('entidade', this.entidade())
            .eq('registro_id', this.registroId()),
        { silencioso: true },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (linhas) => this.vinculados.set(linhas.map((l) => l.marcador).sort((a, b) => a.nome.localeCompare(b.nome))),
        error: () => this.vinculados.set([]),
      });
  }

  protected escolher(evento: MatAutocompleteSelectedEvent): void {
    this.vincular(of(evento.option.value as Marcador));
    evento.option.deselect();
  }

  protected criarOuVincular(): void {
    const nome = this.filtro().trim();
    if (!nome || !this.podeEditar()) {
      return;
    }
    const existente = this.todos().find((m) => m.nome.toLowerCase() === nome.toLowerCase());
    if (existente) {
      if (!this.vinculados().some((m) => m.id === existente.id)) {
        this.vincular(of(existente));
      }
      this.filtro.set('');
      return;
    }
    const cor = CORES[this.todos().length % CORES.length];
    this.vincular(
      this.supabase.executar<Marcador>(() =>
        this.supabase.cliente.from('marcadores').insert({ nome, cor }).select('id, nome, cor').single(),
      ),
      true,
    );
  }

  protected desvincular(marcador: Marcador): void {
    this.supabase
      .executar<unknown>(() =>
        this.supabase.cliente
          .from('marcadores_vinculos')
          .delete()
          .eq('marcador_id', marcador.id)
          .eq('entidade', this.entidade())
          .eq('registro_id', this.registroId()),
      )
      .subscribe(() => this.vinculados.update((lista) => lista.filter((m) => m.id !== marcador.id)));
  }

  private vincular(origem: Observable<Marcador>, novo = false): void {
    this.filtro.set('');
    origem
      .pipe(
        switchMap((marcador) =>
          this.supabase
            .executar<unknown>(() =>
              this.supabase.cliente
                .from('marcadores_vinculos')
                .insert({ marcador_id: marcador.id, entidade: this.entidade(), registro_id: this.registroId() }),
            )
            .pipe(switchMap(() => of(marcador))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((marcador) => {
        if (novo) {
          this.todos.update((lista) => [...lista, marcador].sort((a, b) => a.nome.localeCompare(b.nome)));
        }
        this.vinculados.update((lista) => [...lista, marcador].sort((a, b) => a.nome.localeCompare(b.nome)));
      });
  }
}
