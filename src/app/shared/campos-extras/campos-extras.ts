import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PROVEDORES_DE_DATA } from '../datas/data-iso.adapter';
import { OpcaoCampo } from '../formulario-cadastro/formulario-cadastro';
import { CampoExtra, CamposExtrasService, opcoesDoExtra } from './campos-extras.service';

/** Nome do grupo que o componente acrescenta ao formulário pai. */
export const GRUPO_DE_EXTRAS = 'extras';

/** Junta o grupo `extras` do formulário com o que já estava gravado (campos desativados são mantidos). */
export function extrasDoFormulario(form: FormGroup, anteriores: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const grupo = form.get(GRUPO_DE_EXTRAS) as FormGroup | null;
  return { ...(anteriores ?? {}), ...(grupo?.getRawValue() ?? {}) };
}

/**
 * Campos extras para formulários feitos à mão. Acrescenta o grupo `extras` ao `form` recebido;
 * os formulários genéricos de cadastro não precisam dele (basta informar a entidade).
 */
@Component({
  selector: 'app-campos-extras',
  imports: [ReactiveFormsModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  providers: [PROVEDORES_DE_DATA],
  template: `
    @if (campos().length) {
      <div class="grade" [formGroup]="grupo">
        @for (campo of campos(); track campo.id) {
          @switch (campo.tipo) {
            @case ('toggle') {
              <mat-slide-toggle class="meia" [formControlName]="campo.chave">{{ campo.rotulo }}</mat-slide-toggle>
            }
            @case ('select') {
              <mat-form-field appearance="outline" class="meia">
                <mat-label>{{ campo.rotulo }}</mat-label>
                <mat-select [formControlName]="campo.chave">
                  @if (!campo.obrigatorio) {
                    <mat-option [value]="null">—</mat-option>
                  }
                  @for (opcao of opcoes(campo); track opcao.rotulo) {
                    <mat-option [value]="opcao.valor">{{ opcao.rotulo }}</mat-option>
                  }
                </mat-select>
                @if (grupo.controls[campo.chave].hasError('required')) {
                  <mat-error>Campo obrigatório</mat-error>
                }
              </mat-form-field>
            }
            @case ('multipla') {
              <mat-form-field appearance="outline" class="inteira">
                <mat-label>{{ campo.rotulo }}</mat-label>
                <mat-select multiple [formControlName]="campo.chave">
                  @for (opcao of opcoes(campo); track opcao.rotulo) {
                    <mat-option [value]="opcao.valor">{{ opcao.rotulo }}</mat-option>
                  }
                </mat-select>
                @if (grupo.controls[campo.chave].hasError('required')) {
                  <mat-error>Campo obrigatório</mat-error>
                }
              </mat-form-field>
            }
            @case ('data') {
              <mat-form-field appearance="outline" class="meia">
                <mat-label>{{ campo.rotulo }}</mat-label>
                <input matInput [matDatepicker]="seletor" [formControlName]="campo.chave" />
                <mat-datepicker-toggle matIconSuffix [for]="seletor" />
                <mat-datepicker #seletor />
                @if (grupo.controls[campo.chave].hasError('required')) {
                  <mat-error>Campo obrigatório</mat-error>
                }
              </mat-form-field>
            }
            @case ('textarea') {
              <mat-form-field appearance="outline" class="inteira">
                <mat-label>{{ campo.rotulo }}</mat-label>
                <textarea matInput rows="3" maxlength="2000" [formControlName]="campo.chave"></textarea>
                @if (grupo.controls[campo.chave].hasError('required')) {
                  <mat-error>Campo obrigatório</mat-error>
                }
              </mat-form-field>
            }
            @default {
              <mat-form-field appearance="outline" class="meia">
                <mat-label>{{ campo.rotulo }}</mat-label>
                <input
                  matInput
                  [type]="campo.tipo === 'numero' ? 'number' : campo.tipo === 'email' ? 'email' : 'text'"
                  [attr.maxlength]="campo.tipo === 'numero' ? null : 200"
                  [formControlName]="campo.chave"
                />
                @if (grupo.controls[campo.chave].hasError('required')) {
                  <mat-error>Campo obrigatório</mat-error>
                } @else if (grupo.controls[campo.chave].hasError('email')) {
                  <mat-error>E-mail inválido</mat-error>
                }
              </mat-form-field>
            }
          }
        }
      </div>
    }
  `,
  styles: `
    .grade {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 16px;
      align-items: center;
    }

    .inteira {
      grid-column: 1 / -1;
    }

    mat-slide-toggle {
      margin-bottom: 20px;
    }

    @media (max-width: 600px) {
      .grade {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CamposExtras implements OnInit {
  private readonly camposExtras = inject(CamposExtrasService);
  private readonly destroyRef = inject(DestroyRef);

  readonly entidade = input.required<string>();
  readonly form = input.required<FormGroup>();
  readonly gravados = input<Record<string, unknown> | null | undefined>(null);

  protected readonly campos = signal<CampoExtra[]>([]);
  protected readonly grupo = new FormGroup<Record<string, FormControl<unknown>>>({});
  protected readonly opcoes = (campo: CampoExtra): OpcaoCampo[] => opcoesDoExtra(campo);

  ngOnInit(): void {
    this.form().setControl(GRUPO_DE_EXTRAS, this.grupo);
    this.camposExtras
      .ativos(this.entidade())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((campos) => {
        const gravados = this.gravados() ?? {};
        for (const campo of campos) {
          const validadores: ValidatorFn[] = [];
          if (campo.obrigatorio && campo.tipo !== 'toggle') {
            validadores.push(Validators.required);
          }
          if (campo.tipo === 'email') {
            validadores.push(Validators.email);
          }
          const inicial = gravados[campo.chave] ?? (campo.tipo === 'toggle' ? false : campo.tipo === 'multipla' ? [] : null);
          this.grupo.setControl(campo.chave, new FormControl<unknown>(inicial, validadores));
        }
        this.campos.set(campos);
      });
  }
}
