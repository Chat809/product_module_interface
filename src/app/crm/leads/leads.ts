import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EMPTY, Observable, catchError, filter, finalize, forkJoin, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { UsuarioOpcao } from '../../demandas/demanda.model';
import { posicaoNaColuna } from '../../demandas/demanda-board/demanda-board';
import { Avatar } from '../../shared/avatar/avatar';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { DialogosCadastro } from '../../shared/formulario-cadastro/dialogos-cadastro.service';
import { CampoCadastro } from '../../shared/formulario-cadastro/formulario-cadastro';
import {
  AcaoCadastro,
  ColunaCadastro,
  FonteCadastro,
  ListaCadastro,
} from '../../shared/lista-cadastro/lista-cadastro';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { TextoDialog, TextoDialogData } from '../../shared/texto-dialog/texto-dialog';
import { CrmEtapa, CrmOrigem, Lead, ordemNaPosicao } from '../crm.model';
import { CrmService } from '../crm.service';
import { LeadDetalhe, LeadDetalheData } from '../lead-detalhe/lead-detalhe';

type Modo = 'lista' | 'funil';
const CHAVE_DO_MODO = 'tribo.leads.modo';

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

@Component({
  selector: 'app-leads',
  imports: [
    CdkDrag,
    CdkDragPlaceholder,
    CdkDropList,
    CdkDropListGroup,
    CurrencyPipe,
    DatePipe,
    NgTemplateOutlet,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    Avatar,
    ListaCadastro,
    Skeleton,
  ],
  templateUrl: './leads.html',
  styleUrl: '../quadro-crm.scss',
})
export class Leads implements OnInit {
  private readonly crm = inject(CrmService);
  private readonly dialogos = inject(DialogosCadastro);
  private readonly dialog = inject(MatDialog);
  private readonly notificacao = inject(Notificacao);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lista = viewChild(ListaCadastro<Lead>);

  protected readonly modo = signal<Modo>(localStorage.getItem(CHAVE_DO_MODO) === 'funil' ? 'funil' : 'lista');
  protected readonly etapas = signal<CrmEtapa[]>([]);
  protected readonly origens = signal<CrmOrigem[]>([]);
  protected readonly responsaveis = signal<UsuarioOpcao[]>([]);
  protected readonly pessoas = computed(() => new Map(this.responsaveis().map((r) => [r.id, r])));
  protected readonly etapasAtivas = computed(() => this.etapas().filter((e) => e.ativo));

  /** Filtros: a etapa vale só na lista; busca e responsável valem nas duas visões. */
  protected readonly etapaFiltro = signal<string | null>(null);
  protected readonly responsavelFiltro = signal<string | null>(null);
  protected readonly busca = signal('');

  protected readonly leads = signal<Lead[] | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

  private readonly porEtapa = computed(() => {
    const mapa = new Map<string, Lead[]>(this.etapas().map((e) => [e.id, []]));
    for (const lead of this.leads() ?? []) {
      mapa.get(lead.etapaId)?.push(lead);
    }
    mapa.forEach((lista) => lista.sort((a, b) => a.ordem - b.ordem));
    return mapa;
  });

  protected readonly visiveis = computed(() => {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    const responsavel = this.responsavelFiltro();
    const passa = (l: Lead) =>
      (!responsavel || l.responsavelId === responsavel) &&
      (!termo || `${l.nome} ${l.empresa ?? ''} ${l.email ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo));
    const mapa = new Map<string, Lead[]>();
    this.porEtapa().forEach((lista, etapa) => mapa.set(etapa, lista.filter(passa)));
    return mapa;
  });

  protected readonly fonte: FonteCadastro<Lead> = (filtro, pagina, tamanho) =>
    this.crm.listarLeads(
      filtro,
      { etapaId: this.etapaFiltro(), responsavelId: this.responsavelFiltro() },
      pagina,
      tamanho,
    );

  protected readonly colunas = computed<ColunaCadastro<Lead>[]>(() => {
    const etapas = new Map(this.etapas().map((e) => [e.id, e.nome]));
    const origens = new Map(this.origens().map((o) => [o.id, o.nome]));
    const pessoas = this.pessoas();
    return [
      { chave: 'nome', rotulo: 'Lead', valor: (l) => l.nome, detalhe: (l) => l.empresa },
      { chave: 'etapa', rotulo: 'Etapa', valor: (l) => etapas.get(l.etapaId), detalhe: (l) => (l.clienteId ? 'Cliente' : null) },
      { chave: 'origem', rotulo: 'Origem', valor: (l) => (l.origemId ? origens.get(l.origemId) : null) },
      { chave: 'valor', rotulo: 'Valor estimado', valor: (l) => (l.valorEstimado !== null ? MOEDA.format(l.valorEstimado) : null) },
      { chave: 'responsavel', rotulo: 'Responsável', valor: (l) => (l.responsavelId ? pessoas.get(l.responsavelId)?.nome : null) },
      {
        chave: 'proxima',
        rotulo: 'Próxima ação',
        valor: (l) => l.proximaAcao,
        detalhe: (l) => (l.proximaAcaoEm ? l.proximaAcaoEm.split('-').reverse().join('/') : null),
      },
    ];
  });

  protected readonly acoes: AcaoCadastro<Lead>[] = [
    {
      icone: 'how_to_reg',
      rotulo: 'Converter em cliente',
      executar: (lead) => this.converter(lead).subscribe(() => this.atualizarTela()),
    },
  ];

  ngOnInit(): void {
    forkJoin({
      etapas: this.crm.etapas(),
      origens: this.crm.origens().pipe(catchError(() => of([]))),
      responsaveis: this.crm.responsaveis().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ etapas, origens, responsaveis }) => {
        this.etapas.set(etapas);
        this.origens.set(origens);
        this.responsaveis.set(responsaveis);
        if (this.modo() === 'funil') {
          this.carregarFunil();
        }
      });
  }

  protected mudarModo(modo: Modo): void {
    this.modo.set(modo);
    localStorage.setItem(CHAVE_DO_MODO, modo);
    if (modo === 'funil') {
      this.carregarFunil();
    }
  }

  protected filtrarLista(): void {
    this.lista()?.recarregar();
  }

  protected carregarFunil(): void {
    this.carregando.set(true);
    this.erro.set(false);
    this.crm
      .funil('', null)
      .pipe(
        finalize(() => this.carregando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (leads) => this.leads.set(leads), error: () => this.erro.set(true) });
  }

  protected totalDa(etapa: CrmEtapa): number {
    return (this.visiveis().get(etapa.id) ?? []).reduce((soma, l) => soma + (l.valorEstimado ?? 0), 0);
  }

  protected soltar(evento: CdkDragDrop<CrmEtapa, CrmEtapa, Lead>): void {
    const lead = evento.item.data;
    const destino = evento.container.data;
    if (evento.previousContainer.data.id === destino.id && evento.previousIndex === evento.currentIndex) {
      return;
    }
    const semEle = (lista: Lead[]) => lista.filter((l) => l.id !== lead.id);
    const completa = semEle(this.porEtapa().get(destino.id) ?? []);
    const posicao = posicaoNaColuna(semEle(this.visiveis().get(destino.id) ?? []), completa, evento.currentIndex);
    const ordem = ordemNaPosicao(completa, posicao);
    const mudouDeEtapa = destino.id !== lead.etapaId;

    const motivo$: Observable<string | null> =
      mudouDeEtapa && destino.tipo === 'PERDIDO'
        ? this.dialog
            .open<TextoDialog, TextoDialogData, string>(TextoDialog, {
              data: {
                titulo: `Mover para "${destino.nome}"`,
                rotulo: 'Motivo da perda',
                valor: lead.motivoPerda,
                obrigatorio: true,
                max: 300,
                textoConfirmar: 'Mover',
              },
            })
            .afterClosed()
            .pipe(switchMap((texto) => (texto ? of(texto) : EMPTY)))
        : of(null);

    motivo$
      .pipe(
        tap(() =>
          this.leads.update((lista) =>
            (lista ?? []).map((l) => (l.id === lead.id ? { ...l, etapaId: destino.id, ordem } : l)),
          ),
        ),
        switchMap((motivo) => this.crm.moverLead(lead.id, destino.id, ordem, motivo)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (salvo) => this.substituir(salvo),
        error: () => this.carregarFunil(),
      });
  }

  protected novo(etapa?: CrmEtapa): void {
    this.formulario(undefined, etapa?.id).subscribe(() => this.atualizarTela());
  }

  protected abrir(lead: Lead): void {
    this.dialog
      .open<LeadDetalhe, LeadDetalheData, boolean>(LeadDetalhe, {
        data: {
          lead,
          etapas: this.etapas(),
          origens: this.origens(),
          pessoas: this.pessoas(),
          editar: (atual) => this.formulario(atual),
          converter: (atual) => this.converter(atual),
          excluir: (atual) => this.dialogos.excluir(`O lead "${atual.nome}"`, () => this.crm.excluirLead(atual.id)),
        },
        width: '760px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((alterado) => {
        if (alterado) {
          this.atualizarTela();
        }
      });
  }

  protected editar(lead: Lead): void {
    this.formulario(lead).subscribe(() => this.atualizarTela());
  }

  protected excluir(lead: Lead): void {
    this.dialogos
      .excluir(`O lead "${lead.nome}"`, () => this.crm.excluirLead(lead.id))
      .subscribe(() => this.atualizarTela());
  }

  protected responsavel(lead: Lead): UsuarioOpcao | null {
    return lead.responsavelId ? (this.pessoas().get(lead.responsavelId) ?? null) : null;
  }

  protected atrasado(lead: Lead): boolean {
    if (!lead.proximaAcaoEm) {
      return false;
    }
    const hoje = new Date();
    const local = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    return lead.proximaAcaoEm < local;
  }

  private converter(lead: Lead): Observable<Lead> {
    if (lead.clienteId) {
      this.notificacao.info('Este lead já é cliente.');
      return EMPTY;
    }
    return this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          titulo: 'Converter em cliente?',
          mensagem: `Será criado um cliente com os dados de "${lead.nome}" e o lead irá para a etapa de ganho.`,
          textoConfirmar: 'Converter',
        },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.crm.converterLead(lead.id)),
        tap(() => this.notificacao.sucesso('Cliente criado a partir do lead.')),
      );
  }

  private formulario(lead?: Lead, etapaId?: string): Observable<Lead> {
    const campos: CampoCadastro[] = [
      { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 150, meia: true },
      { chave: 'empresa', rotulo: 'Empresa', max: 150, meia: true },
      { chave: 'email', rotulo: 'E-mail', tipo: 'email', max: 254, meia: true },
      { chave: 'telefone', rotulo: 'Telefone', max: 30, meia: true },
      {
        chave: 'origemId',
        rotulo: 'Origem',
        tipo: 'select',
        meia: true,
        opcoes: this.origens()
          .filter((o) => o.ativo || o.id === lead?.origemId)
          .map((o) => ({ valor: o.id, rotulo: o.nome })),
      },
      ...(lead
        ? []
        : [
            {
              chave: 'etapaId',
              rotulo: 'Etapa',
              tipo: 'select',
              obrigatorio: true,
              meia: true,
              opcoes: this.etapasAtivas().map((e) => ({ valor: e.id, rotulo: e.nome })),
            } as CampoCadastro,
          ]),
      { chave: 'valorEstimado', rotulo: 'Valor estimado (R$)', tipo: 'numero', min: 0, meia: true },
      {
        chave: 'responsavelId',
        rotulo: 'Responsável',
        tipo: 'select',
        meia: true,
        opcoes: this.responsaveis().map((r) => ({ valor: r.id, rotulo: r.nome })),
      },
      { chave: 'proximaAcao', rotulo: 'Próxima ação', max: 200, meia: true },
      { chave: 'proximaAcaoEm', rotulo: 'Data da próxima ação', tipo: 'data', meia: true },
      { chave: 'observacoes', rotulo: 'Observações', tipo: 'textarea', max: 2000 },
      { chave: 'utmSource', rotulo: 'UTM source', max: 150, meia: true },
      { chave: 'utmMedium', rotulo: 'UTM medium', max: 150, meia: true },
      { chave: 'utmCampaign', rotulo: 'UTM campaign', max: 150, meia: true },
      { chave: 'utmTerm', rotulo: 'UTM term', max: 150, meia: true },
      { chave: 'utmContent', rotulo: 'UTM content', max: 150, meia: true },
    ];
    const primeira = this.etapasAtivas().find((e) => e.tipo === 'ABERTA');
    return this.dialogos.formulario(
      {
        titulo: lead ? 'Editar lead' : 'Novo lead',
        entidade: 'leads',
        campos,
        valores: lead
          ? { ...lead }
          : { etapaId: etapaId ?? primeira?.id ?? null, responsavelId: this.auth.usuario()?.id ?? null },
        salvar: (dados) => this.crm.salvarLead(lead?.id ?? null, dados),
      },
      lead ? 'Lead atualizado.' : 'Lead cadastrado.',
    );
  }

  private atualizarTela(): void {
    if (this.modo() === 'funil') {
      this.carregarFunil();
    } else {
      this.lista()?.recarregar();
    }
  }

  private substituir(salvo: Lead): void {
    this.leads.update((lista) => (lista ?? []).map((l) => (l.id === salvo.id ? salvo : l)));
  }
}
