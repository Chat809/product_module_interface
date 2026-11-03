import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, finalize, switchMap } from 'rxjs';
import { ProblemDetail } from '../../core/http/error.interceptor';
import { Avatar } from '../../shared/avatar/avatar';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import {
  COLUNAS,
  Demanda,
  DemandaRequest,
  StatusDemanda,
  TIPOS,
  TipoDemanda,
  URGENCIAS,
  UrgenciaDemanda,
  UsuarioOpcao,
} from '../demanda.model';
import { DemandaService } from '../demanda.service';

/** Sem demanda, o diálogo cria (na coluna `status`); com demanda, edita. */
export interface DemandaFormData {
  demanda?: Demanda;
  status?: StatusDemanda;
  opcoes: UsuarioOpcao[];
  /** Só quem criou a demanda ou um administrador pode excluí-la; a API confere de novo. */
  podeExcluir: boolean;
}

export type ResultadoDemandaForm = { tipo: 'salva'; demanda: Demanda } | { tipo: 'excluida'; id: string };

export const MAXIMO_DE_RESPONSAVEIS = 20;
export const MAXIMO_DE_ITENS = 50;

type Campo = 'titulo' | 'descricao';

const MENSAGENS: Record<Campo, [validador: string, mensagem: string][]> = {
  titulo: [
    ['required', 'O título é obrigatório'],
    ['pattern', 'O título é obrigatório'],
    ['maxlength', 'O título deve ter no máximo 150 caracteres'],
  ],
  descricao: [['maxlength', 'A descrição deve ter no máximo 5000 caracteres']],
};

@Component({
  selector: 'app-demanda-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    Avatar,
  ],
  templateUrl: './demanda-form.html',
  styleUrl: './demanda-form.scss',
})
export class DemandaFormDialog {
  private readonly demandaService = inject(DemandaService);
  private readonly dialogRef = inject<MatDialogRef<DemandaFormDialog, ResultadoDemandaForm>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly data = inject<DemandaFormData>(MAT_DIALOG_DATA);

  protected readonly demanda = this.data.demanda;
  protected readonly colunas = COLUNAS;
  protected readonly listaDeTipos = Object.entries(TIPOS) as [TipoDemanda, { rotulo: string; icone: string }][];
  protected readonly listaDeUrgencias = Object.entries(URGENCIAS) as [UrgenciaDemanda, string][];
  protected readonly maximoDeItens = MAXIMO_DE_ITENS;
  protected readonly salvando = signal(false);

  /** Responsáveis que saíram do painel continuam visíveis para poderem ser removidos. */
  protected readonly opcoes: UsuarioOpcao[] = [
    ...this.data.opcoes,
    ...(this.demanda?.responsaveis ?? [])
      .filter((id) => !this.data.opcoes.some((o) => o.id === id))
      .map((id) => ({ id, nome: 'Usuário removido', avatarUrl: null })),
  ];

  protected readonly form = this.fb.group({
    titulo: [this.demanda?.titulo ?? '', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    descricao: [this.demanda?.descricao ?? '', [Validators.maxLength(5000)]],
    tipo: [this.demanda?.tipo ?? ('TAREFA' as TipoDemanda)],
    urgencia: [this.demanda?.urgencia ?? ('MEDIA' as UrgenciaDemanda)],
    status: [this.demanda?.status ?? this.data.status ?? ('A_FAZER' as StatusDemanda)],
    prazo: [this.demanda?.prazo ?? ''],
    responsaveis: [this.demanda?.responsaveis ?? ([] as string[]), [Validators.maxLength(MAXIMO_DE_RESPONSAVEIS)]],
    checklist: this.fb.array(
      (this.demanda?.checklist ?? []).map((item) =>
        this.fb.group({ texto: [item.texto, [Validators.required, Validators.maxLength(200)]], feito: [item.feito] }),
      ),
    ),
  });

  protected readonly novoItem = this.fb.control('', [Validators.maxLength(200)]);

  private readonly itens = toSignal(this.form.controls.checklist.valueChanges, {
    initialValue: this.form.controls.checklist.getRawValue(),
  });
  protected readonly progresso = computed(() => {
    const itens = this.itens();
    return { feitos: itens.filter((i) => i.feito).length, total: itens.length };
  });

  protected readonly escolhidos = toSignal(this.form.controls.responsaveis.valueChanges, {
    initialValue: this.form.controls.responsaveis.value,
  });

  get checklist(): FormArray {
    return this.form.controls.checklist;
  }

  protected opcao(id: string): UsuarioOpcao | undefined {
    return this.opcoes.find((o) => o.id === id);
  }

  protected adicionarItem(evento?: Event): void {
    evento?.preventDefault();
    const texto = this.novoItem.value.trim();
    if (!texto || this.novoItem.invalid || this.checklist.length >= MAXIMO_DE_ITENS) {
      return;
    }
    this.checklist.push(this.fb.group({ texto: [texto, [Validators.required, Validators.maxLength(200)]], feito: [false] }));
    this.novoItem.reset();
    this.form.markAsDirty();
  }

  protected removerItem(indice: number): void {
    this.checklist.removeAt(indice);
    this.form.markAsDirty();
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valor = this.form.getRawValue();
    const dados: DemandaRequest = {
      titulo: valor.titulo.trim(),
      descricao: valor.descricao.trim() || null,
      tipo: valor.tipo,
      urgencia: valor.urgencia,
      status: valor.status,
      prazo: valor.prazo || null,
      responsaveis: valor.responsaveis,
      checklist: valor.checklist.map((i: { texto: string; feito: boolean }) => ({ texto: i.texto.trim(), feito: i.feito })),
    };
    this.salvando.set(true);
    const requisicao = this.demanda
      ? this.demandaService.atualizar(this.demanda.id, dados)
      : this.demandaService.criar(dados);
    requisicao
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (demanda) => this.dialogRef.close({ tipo: 'salva', demanda }),
        error: (erro: HttpErrorResponse) => {
          (erro.error as ProblemDetail | null)?.erros?.forEach(({ campo, mensagem }) =>
            this.form.get(campo)?.setErrors({ api: mensagem }),
          );
          this.form.markAllAsTouched();
        },
      });
  }

  protected excluir(): void {
    const demanda = this.demanda;
    if (!demanda) {
      return;
    }
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          titulo: 'Excluir demanda',
          mensagem: `Deseja excluir "${demanda.titulo}"? Esta ação não pode ser desfeita.`,
          textoConfirmar: 'Excluir',
        },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.demandaService.excluir(demanda.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.dialogRef.close({ tipo: 'excluida', id: demanda.id }));
  }

  protected mensagemDeErro(campo: Campo): string {
    const erros = this.form.controls[campo].errors;
    if (!erros) {
      return '';
    }
    return erros['api'] ?? MENSAGENS[campo].find(([validador]) => erros[validador])?.[1] ?? 'Valor inválido';
  }
}
