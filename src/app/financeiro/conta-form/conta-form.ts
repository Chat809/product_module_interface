import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable, catchError, finalize, map, of } from 'rxjs';
import { ProblemDetail } from '../../core/supabase/erros';
import { SomenteNumeros } from '../../shared/somente-numeros/somente-numeros';
import {
  Conta,
  ContaRequest,
  FORMAS_DE_PAGAMENTO,
  FormaPagamento,
  TIPOS_DE_CONTA,
  TipoConta,
  calcularImposto,
  formatarDocumento,
} from '../financeiro.model';
import { FinanceiroService } from '../financeiro.service';
import { CrmService } from '../../crm/crm.service';
import { PROVEDORES_DE_DATA } from '../../shared/datas/data-iso.adapter';

interface OpcaoVinculo {
  id: string;
  nome: string;
  documento: string | null;
  chavePix: string | null;
}

/** Sem conta, o diálogo lança; com conta, edita. */
export interface ContaFormData {
  tipo: TipoConta;
  conta?: Conta;
}

type Campo =
  | 'descricao'
  | 'pessoa'
  | 'documento'
  | 'categoria'
  | 'valor'
  | 'percentualImposto'
  | 'vencimento'
  | 'chavePix'
  | 'observacoes';

const MENSAGENS: Record<Campo, [validador: string, mensagem: string][]> = {
  descricao: [
    ['required', 'A descrição é obrigatória'],
    ['pattern', 'A descrição é obrigatória'],
    ['maxlength', 'A descrição deve ter no máximo 150 caracteres'],
  ],
  pessoa: [
    ['required', 'Informe a pessoa ou empresa'],
    ['pattern', 'Informe a pessoa ou empresa'],
    ['maxlength', 'O nome deve ter no máximo 150 caracteres'],
  ],
  documento: [['maxlength', 'O documento deve ter no máximo 30 caracteres']],
  categoria: [['maxlength', 'A categoria deve ter no máximo 60 caracteres']],
  valor: [
    ['required', 'O valor é obrigatório'],
    ['min', 'O valor deve ser maior que zero'],
    ['pattern', 'Use até 12 dígitos inteiros e 2 casas decimais'],
  ],
  percentualImposto: [
    ['min', 'O imposto não pode ser negativo'],
    ['max', 'O imposto deve ser no máximo 100%'],
    ['pattern', 'Use até 2 casas decimais'],
  ],
  vencimento: [
    ['matDatepickerParse', 'Data inválida; use dd/mm/aaaa'],
    ['required', 'O vencimento é obrigatório'],
  ],
  chavePix: [
    ['required', 'Informe a chave Pix'],
    ['pattern', 'Informe a chave Pix'],
    ['maxlength', 'A chave Pix deve ter no máximo 140 caracteres'],
  ],
  observacoes: [['maxlength', 'As observações devem ter no máximo 1000 caracteres']],
};

const VALIDADORES_DA_CHAVE = [Validators.required, Validators.pattern(/\S/), Validators.maxLength(140)];

function textoOuNulo(valor: string): string | null {
  return valor.trim() || null;
}

@Component({
  selector: 'app-conta-form-dialog',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    SomenteNumeros,
  ],
  providers: [PROVEDORES_DE_DATA],
  templateUrl: './conta-form.html',
  styleUrl: './conta-form.scss',
})
export class ContaFormDialog {
  private readonly financeiroService = inject(FinanceiroService);
  private readonly crmService = inject(CrmService);
  private readonly dialogRef = inject<MatDialogRef<ContaFormDialog, Conta>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly data = inject<ContaFormData>(MAT_DIALOG_DATA);

  protected readonly tipo = this.data.tipo;
  protected readonly conta = this.data.conta;
  protected readonly dados = TIPOS_DE_CONTA[this.tipo];
  protected readonly formas = Object.entries(FORMAS_DE_PAGAMENTO) as [FormaPagamento, string][];
  protected readonly salvando = signal(false);

  protected readonly form = this.fb.group({
    descricao: [this.conta?.descricao ?? '', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    pessoa: [this.conta?.pessoa ?? '', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    documento: [this.conta?.documento ?? '', [Validators.maxLength(30)]],
    categoria: [this.conta?.categoria ?? '', [Validators.maxLength(60)]],
    valor: this.fb.control<number | null>(this.conta?.valor ?? null, [
      Validators.required,
      Validators.min(0.01),
      Validators.pattern(/^\d{1,12}(\.\d{1,2})?$/),
    ]),
    percentualImposto: this.fb.control<number | null>(this.conta?.percentualImposto ?? 0, [
      Validators.min(0),
      Validators.max(100),
      Validators.pattern(/^\d{1,3}(\.\d{1,2})?$/),
    ]),
    vencimento: [this.conta?.vencimento ?? '', [Validators.required]],
    formaPagamento: [this.conta?.formaPagamento ?? ('PIX' as FormaPagamento)],
    chavePix: [this.conta?.chavePix ?? '', VALIDADORES_DA_CHAVE],
    observacoes: [this.conta?.observacoes ?? '', [Validators.maxLength(1000)]],
    vinculoId: this.fb.control<string | null>(this.conta?.vinculoId ?? null),
    centroCustoId: this.fb.control<string | null>(this.conta?.centroCustoId ?? null),
  });

  /** Fornecedores (a pagar) ou clientes (a receber) ativos para vincular à conta. */
  protected readonly vinculos = toSignal(
    (this.tipo === 'contas-pagar'
      ? this.financeiroService
          .opcoesDeFornecedores()
          .pipe(
            map((lista) =>
              lista.map((f) => ({ id: f.id, nome: f.razaoSocial, documento: f.documento, chavePix: f.chavePix })),
            ),
          )
      : this.opcoesDeClientes()
    ).pipe(catchError(() => of([] as OpcaoVinculo[]))),
    { initialValue: [] as OpcaoVinculo[] },
  );

  protected readonly centros = toSignal(this.financeiroService.opcoesDeCentros().pipe(catchError(() => of([]))), {
    initialValue: [],
  });

  protected readonly forma = toSignal(this.form.controls.formaPagamento.valueChanges, {
    initialValue: this.form.controls.formaPagamento.value,
  });
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Prévia do que o banco vai calcular; o valor gravado vem sempre da API. */
  protected readonly calculo = computed(() => {
    const { valor, percentualImposto } = this.valores();
    return valor && valor > 0 ? calcularImposto(valor, percentualImposto ?? 0) : null;
  });

  constructor() {
    this.form.controls.formaPagamento.valueChanges.pipe(takeUntilDestroyed()).subscribe((forma) => {
      const chave = this.form.controls.chavePix;
      chave.setValidators(forma === 'PIX' ? VALIDADORES_DA_CHAVE : [Validators.maxLength(140)]);
      chave.updateValueAndValidity();
    });
    if (this.form.controls.formaPagamento.value !== 'PIX') {
      this.form.controls.chavePix.setValidators([Validators.maxLength(140)]);
      this.form.controls.chavePix.updateValueAndValidity();
    }
    this.form.controls.vinculoId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const escolhido = this.vinculos().find((v) => v.id === id);
      if (!escolhido) {
        return;
      }
      const { pessoa, documento, chavePix } = this.form.controls;
      pessoa.setValue(escolhido.nome);
      if (!documento.value && escolhido.documento) {
        documento.setValue(formatarDocumento(escolhido.documento) ?? '');
      }
      if (!chavePix.value && escolhido.chavePix) {
        chavePix.setValue(escolhido.chavePix);
      }
    });
  }

  /** Clientes do CRM para as contas a receber. */
  private opcoesDeClientes(): Observable<OpcaoVinculo[]> {
    return this.crmService
      .opcoesDeClientes()
      .pipe(map((lista) => lista.map((c) => ({ id: c.id, nome: c.nome, documento: c.documento, chavePix: null }))));
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valor = this.form.getRawValue();
    const dados: ContaRequest = {
      descricao: valor.descricao.trim(),
      pessoa: valor.pessoa.trim(),
      documento: textoOuNulo(valor.documento),
      categoria: textoOuNulo(valor.categoria),
      valor: valor.valor as number,
      percentualImposto: valor.percentualImposto ?? 0,
      vencimento: valor.vencimento,
      formaPagamento: valor.formaPagamento,
      chavePix: valor.formaPagamento === 'PIX' ? textoOuNulo(valor.chavePix) : null,
      observacoes: textoOuNulo(valor.observacoes),
      vinculoId: valor.vinculoId,
      centroCustoId: valor.centroCustoId,
    };
    this.salvando.set(true);
    const requisicao = this.conta
      ? this.financeiroService.atualizar(this.tipo, this.conta.id, dados)
      : this.financeiroService.criar(this.tipo, dados);
    requisicao
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (conta) => this.dialogRef.close(conta),
        error: (erro: HttpErrorResponse) => {
          (erro.error as ProblemDetail | null)?.erros?.forEach(({ campo, mensagem }) =>
            this.form.get(campo)?.setErrors({ api: mensagem }),
          );
          this.form.markAllAsTouched();
        },
      });
  }

  protected mensagemDeErro(campo: Campo): string {
    const erros = this.form.controls[campo].errors;
    if (!erros) {
      return '';
    }
    return erros['api'] ?? MENSAGENS[campo].find(([validador]) => erros[validador])?.[1] ?? 'Valor inválido';
  }
}
