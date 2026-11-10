import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
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
import { Observable, catchError, finalize, forkJoin, of } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { UsuarioOpcao } from '../../demandas/demanda.model';
import { Avatar } from '../../shared/avatar/avatar';
import { DialogosCadastro } from '../../shared/formulario-cadastro/dialogos-cadastro.service';
import { CampoCadastro } from '../../shared/formulario-cadastro/formulario-cadastro';
import { ColunaCadastro, FonteCadastro, ListaCadastro } from '../../shared/lista-cadastro/lista-cadastro';
import { Skeleton } from '../../shared/skeleton/skeleton';
import {
  CANAIS,
  Cliente,
  PRIORIDADES,
  ROTULO_DO_STATUS,
  Reclamacao,
  STATUS_DE_RECLAMACAO,
  StatusReclamacao,
  opcoesDe,
} from '../crm.model';
import { CrmService } from '../crm.service';
import { ReclamacaoDetalhe, ReclamacaoDetalheData, mudarStatus } from '../reclamacao-detalhe/reclamacao-detalhe';

type Modo = 'lista' | 'quadro';
const CHAVE_DO_MODO = 'tribo.reclamacoes.modo';

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-reclamacoes',
  imports: [
    CdkDrag,
    CdkDragPlaceholder,
    CdkDropList,
    CdkDropListGroup,
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
  templateUrl: './reclamacoes.html',
  styleUrl: '../quadro-crm.scss',
})
export class Reclamacoes implements OnInit {
  private readonly crm = inject(CrmService);
  private readonly dialogos = inject(DialogosCadastro);
  private readonly dialog = inject(MatDialog);
  private readonly notificacao = inject(Notificacao);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lista = viewChild(ListaCadastro<Reclamacao>);

  protected readonly colunasDoQuadro = STATUS_DE_RECLAMACAO;
  protected readonly prioridades = PRIORIDADES;
  protected readonly modo = signal<Modo>(localStorage.getItem(CHAVE_DO_MODO) === 'quadro' ? 'quadro' : 'lista');
  protected readonly responsaveis = signal<UsuarioOpcao[]>([]);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly pessoas = computed(() => new Map(this.responsaveis().map((r) => [r.id, r])));

  protected readonly statusFiltro = signal<StatusReclamacao | null>(null);
  protected readonly responsavelFiltro = signal<string | null>(null);
  protected readonly busca = signal('');

  protected readonly reclamacoes = signal<Reclamacao[] | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

  protected readonly visiveis = computed(() => {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    const responsavel = this.responsavelFiltro();
    const mapa = new Map<StatusReclamacao, Reclamacao[]>(STATUS_DE_RECLAMACAO.map((c) => [c.status, []]));
    for (const r of this.reclamacoes() ?? []) {
      const texto = `${r.protocolo} ${r.assunto} ${r.cliente?.nome ?? r.nomeContato ?? ''}`.toLocaleLowerCase('pt-BR');
      if ((!responsavel || r.responsavelId === responsavel) && (!termo || texto.includes(termo))) {
        mapa.get(r.status)?.push(r);
      }
    }
    return mapa;
  });

  protected readonly fonte: FonteCadastro<Reclamacao> = (filtro, pagina, tamanho) =>
    this.crm.listarReclamacoes(
      filtro,
      { status: this.statusFiltro(), responsavelId: this.responsavelFiltro() },
      pagina,
      tamanho,
    );

  protected readonly colunas = computed<ColunaCadastro<Reclamacao>[]>(() => {
    const pessoas = this.pessoas();
    return [
      { chave: 'protocolo', rotulo: 'Protocolo', valor: (r) => r.protocolo, detalhe: (r) => r.assunto },
      { chave: 'cliente', rotulo: 'Cliente', valor: (r) => r.cliente?.nome ?? r.nomeContato },
      { chave: 'prioridade', rotulo: 'Prioridade', valor: (r) => PRIORIDADES[r.prioridade] },
      { chave: 'status', rotulo: 'Status', valor: (r) => ROTULO_DO_STATUS[r.status] },
      {
        chave: 'prazo',
        rotulo: 'Prazo',
        valor: (r) => (r.prazo ? r.prazo.split('-').reverse().join('/') : null),
        detalhe: (r) => (this.atrasada(r) ? 'Atrasada' : null),
      },
      { chave: 'responsavel', rotulo: 'Responsável', valor: (r) => (r.responsavelId ? pessoas.get(r.responsavelId)?.nome : null) },
    ];
  });

  ngOnInit(): void {
    forkJoin({
      responsaveis: this.crm.responsaveis().pipe(catchError(() => of([]))),
      clientes: this.crm.opcoesDeClientes().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ responsaveis, clientes }) => {
        this.responsaveis.set(responsaveis);
        this.clientes.set(clientes);
      });
    if (this.modo() === 'quadro') {
      this.carregarQuadro();
    }
  }

  protected mudarModo(modo: Modo): void {
    this.modo.set(modo);
    localStorage.setItem(CHAVE_DO_MODO, modo);
    if (modo === 'quadro') {
      this.carregarQuadro();
    }
  }

  protected filtrarLista(): void {
    this.lista()?.recarregar();
  }

  protected carregarQuadro(): void {
    this.carregando.set(true);
    this.erro.set(false);
    this.crm
      .quadroDeReclamacoes('', null)
      .pipe(
        finalize(() => this.carregando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (lista) => this.reclamacoes.set(lista), error: () => this.erro.set(true) });
  }

  protected soltar(evento: CdkDragDrop<StatusReclamacao, StatusReclamacao, Reclamacao>): void {
    const reclamacao = evento.item.data;
    const destino = evento.container.data;
    if (reclamacao.status === destino) {
      return;
    }
    mudarStatus(this.dialog, this.crm, reclamacao, destino)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (salva) => {
          this.reclamacoes.update((lista) => (lista ?? []).map((r) => (r.id === salva.id ? salva : r)));
          this.notificacao.sucesso(`${salva.protocolo}: ${ROTULO_DO_STATUS[salva.status].toLowerCase()}.`);
        },
        error: () => this.carregarQuadro(),
      });
  }

  protected nova(): void {
    this.formulario().subscribe(() => this.atualizarTela());
  }

  protected editar(reclamacao: Reclamacao): void {
    this.formulario(reclamacao).subscribe(() => this.atualizarTela());
  }

  protected abrir(reclamacao: Reclamacao): void {
    this.dialog
      .open<ReclamacaoDetalhe, ReclamacaoDetalheData, boolean>(ReclamacaoDetalhe, {
        data: { reclamacao, pessoas: this.pessoas(), editar: (atual) => this.formulario(atual) },
        width: '760px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((alterada) => {
        if (alterada) {
          this.atualizarTela();
        }
      });
  }

  protected responsavel(reclamacao: Reclamacao): UsuarioOpcao | null {
    return reclamacao.responsavelId ? (this.pessoas().get(reclamacao.responsavelId) ?? null) : null;
  }

  protected atrasada(reclamacao: Reclamacao): boolean {
    return (
      !!reclamacao.prazo &&
      reclamacao.status !== 'RESOLVIDA' &&
      reclamacao.status !== 'ENCERRADA' &&
      reclamacao.prazo < hoje()
    );
  }

  private formulario(reclamacao?: Reclamacao): Observable<Reclamacao> {
    const campos: CampoCadastro[] = [
      {
        chave: 'clienteId',
        rotulo: 'Cliente cadastrado',
        tipo: 'select',
        meia: true,
        opcoes: this.clientes().map((c) => ({ valor: c.id, rotulo: c.nome })),
        dica: 'Ou preencha o nome ao lado',
      },
      { chave: 'nomeContato', rotulo: 'Nome de quem reclamou', max: 150, meia: true },
      { chave: 'contato', rotulo: 'Telefone ou e-mail de retorno', max: 150, meia: true },
      { chave: 'canal', rotulo: 'Canal', tipo: 'select', meia: true, opcoes: opcoesDe(CANAIS) },
      { chave: 'assunto', rotulo: 'Assunto', obrigatorio: true, max: 150 },
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea', obrigatorio: true, max: 4000 },
      { chave: 'prioridade', rotulo: 'Prioridade', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoesDe(PRIORIDADES) },
      { chave: 'prazo', rotulo: 'Prazo', tipo: 'data', meia: true },
      {
        chave: 'responsavelId',
        rotulo: 'Responsável',
        tipo: 'select',
        meia: true,
        opcoes: this.responsaveis().map((r) => ({ valor: r.id, rotulo: r.nome })),
      },
    ];
    return this.dialogos.formulario(
      {
        titulo: reclamacao ? `Editar ${reclamacao.protocolo}` : 'Nova reclamação',
        entidade: 'reclamacoes',
        campos,
        valores: reclamacao ? { ...reclamacao } : { prioridade: 'MEDIA' },
        textoSalvar: reclamacao ? 'Salvar' : 'Abrir reclamação',
        salvar: (dados) => this.crm.salvarReclamacao(reclamacao?.id ?? null, dados),
      },
      reclamacao ? 'Reclamação atualizada.' : 'Reclamação aberta.',
    );
  }

  private atualizarTela(): void {
    if (this.modo() === 'quadro') {
      this.carregarQuadro();
    } else {
      this.lista()?.recarregar();
    }
  }
}
