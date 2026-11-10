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
import { Observable, Subject, debounceTime, filter, finalize, map, switchMap } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { paraSnake } from '../../core/supabase/caixa';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { DialogosCadastro } from '../../shared/formulario-cadastro/dialogos-cadastro.service';
import { CAMPOS_DE_RECORRENCIA } from '../../telas/definicoes/financeiro';
import { editarLinhas } from '../../telas/editor-linhas';
import { OpcoesService } from '../../telas/opcoes.service';
import { Registro } from '../../telas/tela.model';
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
  private readonly dialogos = inject(DialogosCadastro);
  private readonly opcoes = inject(OpcoesService);
  private readonly supabase = inject(SupabaseService);

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

  protected parcelar(conta: Conta): void {
    this.dialogos
      .formulario<string>(
        {
          titulo: `Parcelar "${conta.descricao}"`,
          campos: [
            {
              chave: 'parcelas',
              rotulo: 'Número de parcelas',
              tipo: 'numero',
              obrigatorio: true,
              min: 2,
              max: 120,
              dica: 'O valor é dividido em parcelas mensais a partir do vencimento atual.',
            },
          ],
          valores: { parcelas: 2 },
          textoSalvar: 'Parcelar',
          salvar: (dados) => this.financeiroService.parcelar(this.tipo(), conta.id, Number(dados['parcelas'])),
        },
        'Conta parcelada.',
      )
      .subscribe(() => this.depoisDeAlterar());
  }

  protected tornarRecorrente(conta: Conta): void {
    const tipo = this.tipo() === 'contas-pagar' ? 'PAGAR' : 'RECEBER';
    const proxima = new Date(`${conta.vencimento}T12:00:00`);
    proxima.setMonth(proxima.getMonth() + 1);
    this.opcoes
      .resolver(CAMPOS_DE_RECORRENCIA.filter((c) => c.chave !== 'tipo' && c.chave !== 'ativo'))
      .pipe(
        switchMap((campos) =>
          this.dialogos.formulario<Registro>(
            {
              titulo: 'Tornar recorrente',
              campos,
              valores: {
                frequencia: 'MENSAL',
                descricao: conta.descricao,
                pessoa: conta.pessoa,
                valor: conta.valor,
                formaPagamento: conta.formaPagamento,
                chavePix: conta.chavePix,
                categoria: conta.categoria,
                inicio: conta.vencimento,
                proximaGeracao: proxima.toISOString().slice(0, 10),
                antecedenciaDias: 10,
                fornecedorId: tipo === 'PAGAR' ? conta.vinculoId : null,
                clienteId: tipo === 'RECEBER' ? conta.vinculoId : null,
                centroCustoId: conta.centroCustoId,
                planoContaId: conta.planoContaId ?? null,
                contaBancariaId: conta.contaBancariaId ?? null,
              },
              salvar: (dados) => this.criarRecorrencia(tipo, conta, dados),
            },
            'Recorrência criada.',
          ),
        ),
      )
      .subscribe(() => this.depoisDeAlterar());
  }

  protected ratear(conta: Conta): void {
    editarLinhas(this.dialog, {
      titulo: `Rateio · ${conta.descricao}`,
      subtitulo: 'Distribua o valor entre centros de custo ou contas do plano. A soma não pode passar de 100%.',
      tabela: 'rateios_lancamento',
      chaveDoPai: 'conta_id',
      paiId: conta.id,
      fixos: { tipoConta: this.tipo() === 'contas-pagar' ? 'PAGAR' : 'RECEBER' },
      colunas: [
        { chave: 'centroCustoId', rotulo: 'Centro de custo', tipo: 'select', peso: 2, fonte: { tabela: 'centros_custo', filtro: { ativo: true } } },
        {
          chave: 'planoContaId',
          rotulo: 'Plano de contas',
          tipo: 'select',
          peso: 2,
          fonte: { tabela: 'plano_contas', detalhe: 'codigo', filtro: { ativo: true, aceita_lancamento: true }, ordem: 'codigo' },
        },
        { chave: 'percentual', rotulo: '%', tipo: 'numero', obrigatorio: true },
      ],
      resumo: (linhas) => {
        const soma = linhas.reduce((t, l) => t + (Number(l['percentual']) || 0), 0);
        const valor = ((conta.valor * soma) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `Total: ${soma.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% · ${valor}`;
      },
      validar: (linhas) => {
        if (linhas.some((l) => !l['centroCustoId'] && !l['planoContaId'])) {
          return 'Cada linha precisa de um centro de custo ou de uma conta do plano.';
        }
        if (linhas.some((l) => Number(l['percentual']) <= 0 || Number(l['percentual']) > 100)) {
          return 'Cada percentual deve ficar entre 0 e 100.';
        }
        const soma = linhas.reduce((t, l) => t + Number(l['percentual']), 0);
        return soma > 100.0001 ? 'A soma dos percentuais não pode passar de 100%.' : null;
      },
    }).subscribe(() => this.notificacao.sucesso('Rateio salvo.'));
  }

  private criarRecorrencia(tipo: 'PAGAR' | 'RECEBER', conta: Conta, dados: Record<string, unknown>): Observable<Registro> {
    const tabela = this.tipo() === 'contas-pagar' ? 'contas_pagar' : 'contas_receber';
    const linha = { ...dados, tipo, proximaGeracao: dados['proximaGeracao'] || dados['inicio'] };
    return this.supabase
      .executar<Registro>(() => this.supabase.cliente.from('recorrencias_financeiras').insert(paraSnake(linha)).select().single())
      .pipe(
        switchMap((recorrencia) =>
          this.supabase
            .executar(() => this.supabase.cliente.from(tabela).update({ recorrencia_id: recorrencia['id'] }).eq('id', conta.id))
            .pipe(map(() => recorrencia)),
        ),
      );
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

  private depoisDeAlterar(mensagem?: string): void {
    if (mensagem) {
      this.notificacao.sucesso(mensagem);
    }
    this.carregar();
    this.alterou.emit();
  }
}
