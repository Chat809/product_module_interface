import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { catchError, filter, finalize, merge, of } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { ProblemDetail } from '../../core/supabase/erros';
import { CamposExtras, extrasDoFormulario } from '../../shared/campos-extras/campos-extras';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { SomenteNumeros } from '../../shared/somente-numeros/somente-numeros';
import { Produto, ProdutoRequest, UNIDADES, UnidadeMedida } from '../produto.model';
import { ProdutoService } from '../produto.service';
import { ProdutoStore } from '../produto.store';

/** Sem produto, o diálogo cadastra; com produto, edita. */
export interface ProdutoFormData {
  produto?: Produto;
}

type Campo = 'codigo' | 'nome' | 'descricao' | 'categoria' | 'preco' | 'custo' | 'quantidadeEmEstoque';

/** Mensagens por validador, na mesma linguagem e com as mesmas regras da API. */
const MENSAGENS: Record<Campo, [validador: string, mensagem: string][]> = {
  codigo: [['pattern', 'Até 40 letras, números ou . _ / -, começando por letra ou número']],
  categoria: [['maxlength', 'A categoria deve ter no máximo 60 caracteres']],
  custo: [
    ['min', 'O custo não pode ser negativo'],
    ['pattern', 'Use no máximo 10 dígitos inteiros e 2 casas decimais'],
  ],
  nome: [
    ['required', 'O nome é obrigatório'],
    ['pattern', 'O nome é obrigatório'],
    ['maxlength', 'O nome deve ter no máximo 120 caracteres'],
  ],
  descricao: [['maxlength', 'A descrição deve ter no máximo 500 caracteres']],
  preco: [
    ['required', 'O preço é obrigatório'],
    ['min', 'O preço deve ser maior que zero'],
    ['pattern', 'Use no máximo 10 dígitos inteiros e 2 casas decimais'],
  ],
  quantidadeEmEstoque: [
    ['required', 'A quantidade em estoque é obrigatória'],
    ['min', 'A quantidade em estoque não pode ser negativa'],
    ['pattern', 'Informe um número inteiro'],
  ],
};

@Component({
  selector: 'app-produto-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    SomenteNumeros,
    CamposExtras,
  ],
  templateUrl: './produto-form.html',
  styleUrl: './produto-form.scss',
})
export class ProdutoFormDialog {
  private readonly produtoService = inject(ProdutoService);
  private readonly store = inject(ProdutoStore);
  private readonly notificacao = inject(Notificacao);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject<MatDialogRef<ProdutoFormDialog, Produto>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly produto = inject<ProdutoFormData>(MAT_DIALOG_DATA, { optional: true })?.produto;
  protected readonly editando = this.produto !== undefined;
  protected readonly salvando = signal(false);

  protected readonly unidades = UNIDADES;
  protected readonly categorias = toSignal(this.produtoService.categorias().pipe(catchError(() => of([]))), {
    initialValue: [] as string[],
  });

  protected readonly form = this.fb.group({
    codigo: [this.produto?.codigo ?? '', Validators.pattern(/^\s*([A-Za-z0-9][A-Za-z0-9._/-]{0,39})?\s*$/)],
    categoria: [this.produto?.categoria ?? '', Validators.maxLength(60)],
    unidade: this.fb.control<UnidadeMedida>(this.produto?.unidade ?? 'UN'),
    custo: this.fb.control<number | null>(this.produto?.custo ?? null, [
      Validators.min(0),
      Validators.pattern(/^\d{1,10}(\.\d{1,2})?$/),
    ]),
    ativo: [this.produto?.ativo ?? true],
    nome: [
      this.produto?.nome ?? '',
      [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)],
    ],
    descricao: [this.produto?.descricao ?? '', Validators.maxLength(500)],
    preco: this.fb.control<number | null>(this.produto?.preco ?? null, [
      Validators.required,
      Validators.min(0.01),
      Validators.pattern(/^\d{1,10}(\.\d{1,2})?$/),
    ]),
    quantidadeEmEstoque: this.fb.control<number | null>(this.produto?.quantidadeEmEstoque ?? null, [
      Validators.required,
      Validators.min(0),
      Validators.pattern(/^\d+$/),
    ]),
  });

  constructor() {
    // O fechamento por Esc ou clique fora passa pela mesma confirmação do botão X.
    this.dialogRef.disableClose = true;
    merge(
      this.dialogRef.backdropClick(),
      this.dialogRef.keydownEvents().pipe(filter((evento) => evento.key === 'Escape')),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fechar());
  }

  protected fechar(): void {
    if (!this.form.dirty || this.salvando()) {
      this.dialogRef.close();
      return;
    }
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          titulo: 'Descartar alterações?',
          mensagem: 'Os dados preenchidos neste formulário serão perdidos.',
          textoConfirmar: 'Descartar',
        },
      })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.dialogRef.close());
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valor = this.form.getRawValue();
    const dados: ProdutoRequest = {
      codigo: valor.codigo.trim().toUpperCase() || null,
      nome: valor.nome,
      descricao: valor.descricao || null,
      categoria: valor.categoria.trim() || null,
      unidade: valor.unidade,
      preco: valor.preco as number,
      custo: valor.custo ?? null,
      quantidadeEmEstoque: valor.quantidadeEmEstoque as number,
      ativo: valor.ativo,
      extras: extrasDoFormulario(this.form, this.produto?.extras),
    };
    const requisicao = this.produto
      ? this.produtoService.atualizar(this.produto.id, { ...dados, versao: this.produto.versao })
      : this.produtoService.criar(dados);

    this.salvando.set(true);
    requisicao
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (salvo) => {
          if (this.produto) {
            this.store.substituir(salvo);
            this.notificacao.sucesso(`"${salvo.nome}" atualizado.`);
          } else {
            this.store.adicionar(salvo);
            this.notificacao.sucesso(`"${salvo.nome}" cadastrado.`);
          }
          this.dialogRef.close(salvo);
        },
        error: (erro: HttpErrorResponse) => this.tratarErro(erro),
      });
  }

  protected mensagemDeErro(campo: Campo): string {
    const erros = this.form.controls[campo].errors;
    if (!erros) {
      return '';
    }
    if (erros['api']) {
      return erros['api'];
    }
    return MENSAGENS[campo].find(([validador]) => erros[validador])?.[1] ?? 'Valor inválido';
  }

  private tratarErro(erro: HttpErrorResponse): void {
    const problema = erro.error as ProblemDetail | null;
    if (erro.status === 409 && problema?.title === 'Código já cadastrado') {
      this.form.controls.codigo.setErrors({ api: problema.detail ?? 'Código já cadastrado' });
      this.form.markAllAsTouched();
      return;
    }
    if (this.produto && (erro.status === 409 || erro.status === 404)) {
      // O produto mudou ou sumiu na API: sincroniza o catálogo e fecha, já que os dados do formulário estão defasados.
      this.store.carregar(true);
      this.dialogRef.close();
      return;
    }
    const problem = erro.error as ProblemDetail | null;
    problem?.erros?.forEach(({ campo, mensagem }) =>
      this.form.get(campo)?.setErrors({ api: mensagem }),
    );
    this.form.markAllAsTouched();
  }
}
