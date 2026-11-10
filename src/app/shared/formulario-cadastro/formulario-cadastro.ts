import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Observable, finalize } from 'rxjs';
import { ProblemDetail } from '../../core/supabase/erros';
import { PROVEDORES_DE_DATA } from '../datas/data-iso.adapter';

export type TipoCampo = 'texto' | 'textarea' | 'email' | 'numero' | 'data' | 'datahora' | 'select' | 'multipla' | 'toggle' | 'cor';

/** `2026-11-10T13:30:00+00:00` vira `2026-11-10T10:30` no horário local, o formato do `datetime-local`. */
export function paraDataHoraLocal(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor) {
    return null;
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return null;
  }
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export interface OpcaoCampo {
  valor: unknown;
  rotulo: string;
}

export interface CampoCadastro {
  chave: string;
  rotulo: string;
  tipo?: TipoCampo;
  obrigatorio?: boolean;
  /** Tamanho máximo (texto) ou valor máximo (número). */
  max?: number;
  min?: number;
  padrao?: RegExp;
  mensagemPadrao?: string;
  opcoes?: OpcaoCampo[];
  /** Sugestões de preenchimento para campos de texto. */
  sugestoes?: string[];
  dica?: string;
  /** Ocupa meia linha em telas largas. */
  meia?: boolean;
}

export interface FormularioCadastroData<T> {
  titulo: string;
  campos: CampoCadastro[];
  valores?: Record<string, unknown>;
  textoSalvar?: string;
  /** Tabela do registro: com ela, os campos extras configurados entram no fim do formulário (coluna `extras`). */
  entidade?: string;
  /** Recebe os valores já normalizados (textos aparados, vazios como null) e grava no banco. */
  salvar: (valores: Record<string, unknown>) => Observable<T>;
}

/**
 * Diálogo de cadastro montado a partir da lista de campos. Erros de campo (400) aparecem embaixo do campo
 * correspondente; os demais já foram avisados ao traduzir o erro do banco.
 */
@Component({
  selector: 'app-formulario-cadastro',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  providers: [PROVEDORES_DE_DATA],
  template: `
    <header class="cabecalho">
      <h2 mat-dialog-title>{{ data.titulo }}</h2>
      <button mat-icon-button type="button" aria-label="Fechar" mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </header>
    <form [formGroup]="form" (ngSubmit)="salvar()" novalidate autocomplete="off">
      <mat-dialog-content class="campos">
        @for (campo of data.campos; track campo.chave) {
          @switch (campo.tipo ?? 'texto') {
            @case ('toggle') {
              <mat-slide-toggle class="inteiro" [formControlName]="campo.chave">{{ campo.rotulo }}</mat-slide-toggle>
            }
            @case ('select') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" [class.inteiro]="!campo.meia">
                <mat-label>{{ campo.rotulo }}</mat-label>
                <mat-select [formControlName]="campo.chave">
                  @if (!campo.obrigatorio) {
                    <mat-option [value]="null">—</mat-option>
                  }
                  @for (opcao of campo.opcoes ?? []; track $index) {
                    <mat-option [value]="opcao.valor">{{ opcao.rotulo }}</mat-option>
                  }
                </mat-select>
                @if (campo.dica) {
                  <mat-hint>{{ campo.dica }}</mat-hint>
                }
                <mat-error>{{ erro(campo) }}</mat-error>
              </mat-form-field>
            }
            @case ('multipla') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" [class.inteiro]="!campo.meia">
                <mat-label>{{ campo.rotulo }}</mat-label>
                <mat-select multiple [formControlName]="campo.chave">
                  @for (opcao of campo.opcoes ?? []; track $index) {
                    <mat-option [value]="opcao.valor">{{ opcao.rotulo }}</mat-option>
                  }
                </mat-select>
                @if (campo.dica) {
                  <mat-hint>{{ campo.dica }}</mat-hint>
                }
                <mat-error>{{ erro(campo) }}</mat-error>
              </mat-form-field>
            }
            @case ('textarea') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inteiro">
                <mat-label>{{ campo.rotulo }}</mat-label>
                <textarea matInput rows="3" [formControlName]="campo.chave" [attr.maxlength]="campo.max ?? null"></textarea>
                @if (campo.dica) {
                  <mat-hint>{{ campo.dica }}</mat-hint>
                }
                <mat-error>{{ erro(campo) }}</mat-error>
              </mat-form-field>
            }
            @case ('data') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" [class.inteiro]="!campo.meia">
                <mat-label>{{ campo.rotulo }}</mat-label>
                <input matInput [matDatepicker]="calendario" [formControlName]="campo.chave" placeholder="dd/mm/aaaa" />
                <mat-datepicker-toggle matIconSuffix [for]="calendario" />
                <mat-datepicker #calendario />
                @if (campo.dica) {
                  <mat-hint>{{ campo.dica }}</mat-hint>
                }
                <mat-error>{{ erro(campo) }}</mat-error>
              </mat-form-field>
            }
            @default {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" [class.inteiro]="!campo.meia">
                <mat-label>{{ campo.rotulo }}</mat-label>
                <input
                  matInput
                  [type]="tipoDoInput(campo)"
                  [formControlName]="campo.chave"
                  [attr.maxlength]="campo.tipo === 'numero' ? null : (campo.max ?? null)"
                  [matAutocomplete]="sugestoes"
                  [matAutocompleteDisabled]="!campo.sugestoes?.length"
                />
                <mat-autocomplete #sugestoes="matAutocomplete">
                  @for (sugestao of campo.sugestoes ?? []; track sugestao) {
                    <mat-option [value]="sugestao">{{ sugestao }}</mat-option>
                  }
                </mat-autocomplete>
                @if (campo.dica) {
                  <mat-hint>{{ campo.dica }}</mat-hint>
                }
                <mat-error>{{ erro(campo) }}</mat-error>
              </mat-form-field>
            }
          }
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="salvando()">
          {{ salvando() ? 'Salvando...' : (data.textoSalvar ?? 'Salvar') }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-right: 12px;
    }

    .campos {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 16px;
      min-width: min(560px, 80vw);
      padding-top: 8px !important;
    }

    .inteiro {
      grid-column: 1 / -1;
    }

    @media (max-width: 600px) {
      .campos {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class FormularioCadastro<T = unknown> {
  protected readonly data = inject<FormularioCadastroData<T>>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<FormularioCadastro<T>, T>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly salvando = signal(false);

  protected readonly form = new FormGroup(
    Object.fromEntries(
      this.data.campos.map((campo) => [
        campo.chave,
        new FormControl<unknown>(this.valorInicial(campo), this.validadores(campo)),
      ]),
    ),
  );

  protected tipoDoInput(campo: CampoCadastro): string {
    const tipos: Record<string, string> = { email: 'email', numero: 'number', cor: 'color', datahora: 'datetime-local' };
    return tipos[campo.tipo ?? 'texto'] ?? 'text';
  }

  protected erro(campo: CampoCadastro): string {
    const erros = this.form.controls[campo.chave].errors;
    if (!erros) {
      return '';
    }
    if (erros['api']) {
      return erros['api'];
    }
    if (erros['required']) {
      return `${campo.rotulo} é obrigatório`;
    }
    if (erros['maxlength']) {
      return `Use no máximo ${campo.max} caracteres`;
    }
    if (erros['email']) {
      return 'Informe um e-mail válido';
    }
    if (erros['min']) {
      return `O valor mínimo é ${campo.min}`;
    }
    if (erros['max']) {
      return `O valor máximo é ${campo.max}`;
    }
    if (erros['matDatepickerParse']) {
      return 'Data inválida; use dd/mm/aaaa';
    }
    return campo.mensagemPadrao ?? 'Valor inválido';
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = Object.fromEntries(
      this.data.campos.map((campo) => [campo.chave, this.normalizar(campo, this.form.controls[campo.chave].value)]),
    );
    this.salvando.set(true);
    this.data
      .salvar(valores)
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (salvo) => this.dialogRef.close(salvo),
        error: (erro: HttpErrorResponse) => {
          (erro.error as ProblemDetail | null)?.erros?.forEach(({ campo, mensagem }) =>
            this.form.get(campo)?.setErrors({ api: mensagem }),
          );
          this.form.markAllAsTouched();
        },
      });
  }

  private valorInicial(campo: CampoCadastro): unknown {
    const valor = this.data.valores?.[campo.chave];
    if (campo.tipo === 'toggle') {
      return valor ?? true;
    }
    if (campo.tipo === 'multipla') {
      return Array.isArray(valor) ? [...valor] : [];
    }
    if (campo.tipo === 'datahora') {
      return paraDataHoraLocal(valor) ?? '';
    }
    if (campo.tipo === 'select' || campo.tipo === 'numero' || campo.tipo === 'data') {
      return valor ?? null;
    }
    return valor ?? '';
  }

  private validadores(campo: CampoCadastro): ValidatorFn[] {
    const validadores: ValidatorFn[] = [];
    if (campo.obrigatorio && campo.tipo !== 'toggle') {
      validadores.push(campo.tipo === 'multipla' ? (c) => (c.value?.length ? null : { required: true }) : Validators.required);
      if (!campo.tipo || campo.tipo === 'texto' || campo.tipo === 'textarea') {
        validadores.push(Validators.pattern(/\S/));
      }
    }
    if (campo.tipo === 'numero') {
      if (campo.min !== undefined) {
        validadores.push(Validators.min(campo.min));
      }
      if (campo.max !== undefined) {
        validadores.push(Validators.max(campo.max));
      }
    } else if (campo.max !== undefined && campo.tipo !== 'multipla') {
      validadores.push(Validators.maxLength(campo.max));
    }
    if (campo.tipo === 'email') {
      validadores.push(Validators.email);
    }
    if (campo.padrao) {
      validadores.push(Validators.pattern(campo.padrao));
    }
    return validadores;
  }

  private normalizar(campo: CampoCadastro, valor: unknown): unknown {
    if (campo.tipo === 'datahora') {
      return typeof valor === 'string' && valor ? new Date(valor).toISOString() : null;
    }
    if (typeof valor === 'string') {
      const texto = valor.trim();
      return texto === '' ? null : texto;
    }
    return valor === undefined ? null : valor;
  }
}
