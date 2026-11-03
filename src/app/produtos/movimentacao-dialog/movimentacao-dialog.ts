import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { finalize, switchMap, tap } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { Loading } from '../../shared/loading/loading';
import { SomenteNumeros } from '../../shared/somente-numeros/somente-numeros';
import { Movimentacao, MovimentacaoRequest, Produto, TipoMovimentacao } from '../produto.model';
import { ProdutoService } from '../produto.service';
import { ProdutoStore } from '../produto.store';

export interface MovimentacaoDialogData {
  produto: Produto;
  tipo?: MovimentacaoRequest['tipo'];
}

const ROTULOS: Record<TipoMovimentacao, { icone: string; texto: string }> = {
  ENTRADA: { icone: 'south_west', texto: 'Entrada' },
  SAIDA: { icone: 'north_east', texto: 'Saída' },
  AJUSTE: { icone: 'tune', texto: 'Ajuste' },
};

@Component({
  selector: 'app-movimentacao-dialog',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    Loading,
    SomenteNumeros,
  ],
  templateUrl: './movimentacao-dialog.html',
  styleUrl: './movimentacao-dialog.scss',
})
export class MovimentacaoDialog implements OnInit {
  private readonly produtoService = inject(ProdutoService);
  private readonly store = inject(ProdutoStore);
  private readonly notificacao = inject(Notificacao);
  private readonly dialogRef = inject<MatDialogRef<MovimentacaoDialog, boolean>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject<MovimentacaoDialogData>(MAT_DIALOG_DATA);

  protected readonly produto = this.data.produto;
  protected readonly rotulos = ROTULOS;
  protected readonly salvando = signal(false);
  protected readonly historico = signal<Movimentacao[] | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    tipo: this.data.tipo ?? ('ENTRADA' as MovimentacaoRequest['tipo']),
    quantidade: [null as number | null, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    motivo: ['', Validators.maxLength(200)],
  });

  private readonly valor = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly saldoPrevisto = computed(() => {
    const { tipo, quantidade } = this.valor();
    const qtd = Number(quantidade) || 0;
    return this.produto.quantidadeEmEstoque + (tipo === 'SAIDA' ? -qtd : qtd);
  });

  protected readonly estoqueInsuficiente = computed(() => this.saldoPrevisto() < 0);

  ngOnInit(): void {
    this.produtoService
      .historico(this.produto.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagina) => this.historico.set(pagina.conteudo),
        error: () => this.historico.set([]),
      });
  }

  protected registrar(): void {
    if (this.form.invalid || this.estoqueInsuficiente()) {
      this.form.markAllAsTouched();
      return;
    }
    const { tipo, quantidade, motivo } = this.form.getRawValue();
    const movimentacao: MovimentacaoRequest = {
      tipo,
      quantidade: quantidade as number,
      motivo: motivo.trim() || null,
    };

    this.salvando.set(true);
    this.produtoService
      .movimentar(this.produto.id, movimentacao)
      .pipe(
        // A movimentação muda o estoque e a versão do produto: busca o estado atualizado.
        switchMap(() => this.produtoService.buscarPorId(this.produto.id)),
        tap((atualizado) => this.store.substituir(atualizado)),
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (atualizado) => {
          const sinal = tipo === 'ENTRADA' ? '+' : '−';
          this.notificacao.sucesso(
            `${ROTULOS[tipo].texto} de ${sinal}${movimentacao.quantidade} em "${atualizado.nome}". Saldo: ${atualizado.quantidadeEmEstoque}.`,
          );
          this.dialogRef.close(true);
        },
        error: () => this.store.carregar(true),
      });
  }

  protected mensagemQuantidade(): string {
    const erros = this.form.controls.quantidade.errors;
    if (erros?.['required']) {
      return 'Informe a quantidade';
    }
    return erros?.['min'] || erros?.['pattern'] ? 'Informe um número inteiro maior que zero' : '';
  }
}
