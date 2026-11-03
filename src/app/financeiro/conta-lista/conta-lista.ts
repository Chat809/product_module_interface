import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime, filter, finalize, switchMap } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { BaixaDialog, BaixaDialogData } from '../baixa-dialog/baixa-dialog';
import { ContaFormData, ContaFormDialog } from '../conta-form/conta-form';
import {
  Conta,
  FORMAS_DE_PAGAMENTO,
  FiltroContas,
  FiltroSituacaoConta,
  TIPOS_DE_CONTA,
  TipoConta,
} from '../financeiro.model';
import { FinanceiroService } from '../financeiro.service';
import { PROVEDORES_DE_DATA } from '../../shared/datas/data-iso.adapter';

const ESPERA_DA_BUSCA_MS = 300;

@Component({
  selector: 'app-conta-lista',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    Skeleton,
  ],
  providers: [PROVEDORES_DE_DATA],
  templateUrl: './conta-lista.html',
  styleUrl: './conta-lista.scss',
})
export class ContaLista implements OnInit {
  private readonly financeiroService = inject(FinanceiroService);
  private readonly notificacao = inject(Notificacao);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly tipo = input.required<TipoConta>();
  /** Avisa a página para recarregar o resumo depois de qualquer alteração. */
  readonly alterou = output<void>();

  protected readonly dados = computed(() => TIPOS_DE_CONTA[this.tipo()]);
  protected readonly formas: Record<string, string> = FORMAS_DE_PAGAMENTO;
  protected readonly colunas = ['vencimento', 'descricao', 'pessoa', 'forma', 'valor', 'imposto', 'liquido', 'status', 'acoes'];
  protected readonly situacoes = computed<[FiltroSituacaoConta, string][]>(() => [
    ['PENDENTE', 'Pendentes'],
    ['VENCIDAS', this.tipo() === 'contas-pagar' ? 'Vencidas' : 'Em atraso'],
    ['QUITADA', this.tipo() === 'contas-pagar' ? 'Pagas' : 'Recebidas'],
    ['CANCELADO', 'Canceladas'],
    ['TODAS', 'Todas'],
  ]);

  protected readonly contas = signal<Conta[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(0);
  protected readonly tamanhoPagina = signal(20);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);
  protected readonly carregouUmaVez = signal(false);
  protected readonly filtro = signal<FiltroContas>({ situacao: 'PENDENTE', busca: '', vencimentoDe: '', vencimentoAte: '' });

  private readonly buscaDigitada = new Subject<string>();

  constructor() {
    this.buscaDigitada
      .pipe(debounceTime(ESPERA_DA_BUSCA_MS), takeUntilDestroyed())
      .subscribe((busca) => this.filtrar({ busca }));
  }

  ngOnInit(): void {
    this.carregar();
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.erro.set(false);
    this.financeiroService
      .listar(this.tipo(), this.filtro(), this.pagina(), this.tamanhoPagina())
      .pipe(
        finalize(() => this.carregando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (pagina) => {
          this.contas.set(pagina.conteudo);
          this.total.set(pagina.totalElementos);
          this.carregouUmaVez.set(true);
        },
        error: () => this.erro.set(true),
      });
  }

  protected digitarBusca(busca: string): void {
    this.filtro.update((f) => ({ ...f, busca }));
    this.buscaDigitada.next(busca);
  }

  protected filtrar(mudanca: Partial<FiltroContas>): void {
    this.filtro.update((f) => ({ ...f, ...mudanca }));
    this.pagina.set(0);
    this.carregar();
  }

  /** Enquanto a data é digitada o campo vale null; só recarrega quando a data completa muda de fato. */
  protected filtrarData(campo: 'vencimentoDe' | 'vencimentoAte', data: string | null): void {
    const valor = data ?? '';
    if (this.filtro()[campo] !== valor) {
      this.filtrar({ [campo]: valor });
    }
  }

  protected mudarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
    this.tamanhoPagina.set(evento.pageSize);
    this.carregar();
  }

  protected rotuloDoStatus(conta: Conta): string {
    if (conta.vencida) {
      return this.tipo() === 'contas-pagar' ? 'Vencida' : 'Em atraso';
    }
    switch (conta.status) {
      case 'PENDENTE':
        return 'Pendente';
      case 'CANCELADO':
        return 'Cancelada';
      default:
        return this.dados().rotuloQuitado;
    }
  }

  protected nova(): void {
    this.abrirFormulario();
  }

  protected editar(conta: Conta): void {
    this.abrirFormulario(conta);
  }

  protected darBaixa(conta: Conta): void {
    this.dialog
      .open<BaixaDialog, BaixaDialogData, Conta>(BaixaDialog, {
        data: { tipo: this.tipo(), conta },
        width: '420px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .pipe(filter((salva): salva is Conta => !!salva))
      .subscribe(() => this.depoisDeAlterar(`${this.dados().rotuloQuitado}: ${conta.descricao}.`));
  }

  protected cancelar(conta: Conta): void {
    this.confirmar({
      titulo: 'Cancelar conta',
      mensagem: `Cancelar "${conta.descricao}"? Ela sai dos totais, mas continua no histórico.`,
      textoConfirmar: 'Cancelar conta',
    })
      .pipe(switchMap(() => this.financeiroService.cancelar(this.tipo(), conta.id)))
      .subscribe(() => this.depoisDeAlterar('Conta cancelada.'));
  }

  protected excluir(conta: Conta): void {
    this.confirmar({
      titulo: 'Excluir conta',
      mensagem: `Excluir "${conta.descricao}"? Use apenas para lançamentos feitos por engano; esta ação não pode ser desfeita.`,
      textoConfirmar: 'Excluir',
    })
      .pipe(switchMap(() => this.financeiroService.excluir(this.tipo(), conta.id)))
      .subscribe(() => this.depoisDeAlterar('Conta excluída.'));
  }

  private abrirFormulario(conta?: Conta): void {
    this.dialog
      .open<ContaFormDialog, ContaFormData, Conta>(ContaFormDialog, {
        data: { tipo: this.tipo(), conta },
        width: '640px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .pipe(filter((salva): salva is Conta => !!salva))
      .subscribe(() => this.depoisDeAlterar(conta ? 'Conta atualizada.' : 'Conta lançada.'));
  }

  private confirmar(data: ConfirmDialogData) {
    return this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(filter(Boolean));
  }

  private depoisDeAlterar(mensagem: string): void {
    this.notificacao.sucesso(mensagem);
    this.carregar();
    this.alterou.emit();
  }
}
