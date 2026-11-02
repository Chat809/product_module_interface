import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ProblemDetail } from '../../core/http/error.interceptor';
import { Loading } from '../../shared/loading/loading';
import { ProdutoRequest } from '../produto.model';
import { ProdutoService } from '../produto.service';

type Campo = 'nome' | 'descricao' | 'preco' | 'quantidadeEmEstoque';

/** Mensagens por validador, na mesma linguagem e com as mesmas regras da API. */
const MENSAGENS: Record<Campo, [validador: string, mensagem: string][]> = {
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
  selector: 'app-produto-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    Loading,
  ],
  templateUrl: './produto-form.html',
  styleUrl: './produto-form.scss',
})
export class ProdutoForm implements OnInit {
  /** Parâmetro `:id` da rota de edição; ausente no cadastro. */
  readonly id = input<string>();

  private readonly produtoService = inject(ProdutoService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly editando = computed(() => this.id() !== undefined);
  protected readonly carregando = signal(false);
  protected readonly salvando = signal(false);

  protected readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)]],
    descricao: ['', Validators.maxLength(500)],
    preco: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.pattern(/^\d{1,10}(\.\d{1,2})?$/),
    ]),
    quantidadeEmEstoque: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.pattern(/^\d+$/),
    ]),
  });

  ngOnInit(): void {
    const id = this.id();
    if (id === undefined) {
      return;
    }
    this.carregando.set(true);
    this.produtoService
      .buscarPorId(Number(id))
      .pipe(
        finalize(() => this.carregando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (produto) =>
          this.form.setValue({
            nome: produto.nome,
            descricao: produto.descricao ?? '',
            preco: produto.preco,
            quantidadeEmEstoque: produto.quantidadeEmEstoque,
          }),
        error: () => this.router.navigate(['/produtos']),
      });
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valor = this.form.getRawValue();
    const produto: ProdutoRequest = {
      nome: valor.nome,
      descricao: valor.descricao || null,
      preco: valor.preco as number,
      quantidadeEmEstoque: valor.quantidadeEmEstoque as number,
    };
    const id = this.id();
    const requisicao =
      id === undefined
        ? this.produtoService.criar(produto)
        : this.produtoService.atualizar(Number(id), produto);

    this.salvando.set(true);
    requisicao
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(
            id === undefined ? 'Produto cadastrado.' : 'Produto atualizado.',
            'Fechar',
            {
              duration: 3000,
            },
          );
          this.router.navigate(['/produtos']);
        },
        error: (erro: HttpErrorResponse) => this.aplicarErrosDaApi(erro),
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

  private aplicarErrosDaApi(erro: HttpErrorResponse): void {
    const problem = erro.error as ProblemDetail | null;
    problem?.erros?.forEach(({ campo, mensagem }) =>
      this.form.get(campo)?.setErrors({ api: mensagem }),
    );
    this.form.markAllAsTouched();
  }
}
