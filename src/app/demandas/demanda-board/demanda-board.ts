import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
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
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { Avatar } from '../../shared/avatar/avatar';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { DemandaFormData, DemandaFormDialog, ResultadoDemandaForm } from '../demanda-form/demanda-form';
import { COLUNAS, Demanda, StatusDemanda, TIPOS, URGENCIAS, UrgenciaDemanda, UsuarioOpcao } from '../demanda.model';
import { DemandaService } from '../demanda.service';

const MAXIMO_DE_AVATARES = 3;

/**
 * Traduz o índice em que o cartão foi solto (na coluna filtrada) para a posição na coluna completa,
 * que é o que a API espera. Ambas as listas chegam sem o cartão que está sendo movido.
 */
export function posicaoNaColuna(visiveis: Demanda[], completa: Demanda[], indice: number): number {
  if (indice < visiveis.length) {
    return completa.indexOf(visiveis[indice]);
  }
  const ultimo = visiveis.at(-1);
  return ultimo ? completa.indexOf(ultimo) + 1 : completa.length;
}

function porOrdem(a: Demanda, b: Demanda): number {
  return a.ordem - b.ordem || (a.criadoEm ?? '').localeCompare(b.criadoEm ?? '');
}

@Component({
  selector: 'app-demanda-board',
  imports: [
    CdkDrag,
    CdkDragPlaceholder,
    CdkDropList,
    CdkDropListGroup,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    Avatar,
    Skeleton,
  ],
  templateUrl: './demanda-board.html',
  styleUrl: './demanda-board.scss',
})
export class DemandaBoard implements OnInit {
  private readonly demandaService = inject(DemandaService);
  private readonly notificacao = inject(Notificacao);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  /** Vem da query string (`/demandas?abrir=<id>`), usada pelos atalhos de "Minhas tarefas". */
  readonly abrir = input<string>();

  protected readonly colunas = COLUNAS;
  protected readonly urgencias = URGENCIAS;
  protected readonly listaDeUrgencias = Object.entries(URGENCIAS) as [UrgenciaDemanda, string][];
  protected readonly tipos = TIPOS;
  protected readonly maximoDeAvatares = MAXIMO_DE_AVATARES;

  protected readonly demandas = signal<Demanda[] | null>(null);
  protected readonly opcoes = signal<UsuarioOpcao[]>([]);
  protected readonly erro = signal(false);
  protected readonly carregando = signal(false);

  protected readonly somenteMinhas = signal(false);
  protected readonly urgencia = signal<UrgenciaDemanda | ''>('');
  protected readonly busca = signal('');

  private readonly pessoas = computed(() => new Map(this.opcoes().map((o) => [o.id, o])));
  private readonly meuId = computed(() => this.auth.usuario()?.id);

  /** Colunas completas, na ordem gravada; servem de referência para calcular a posição ao mover. */
  private readonly porStatus = computed(() => {
    const mapa = new Map<StatusDemanda, Demanda[]>(COLUNAS.map((c) => [c.status, []]));
    for (const demanda of this.demandas() ?? []) {
      mapa.get(demanda.status)?.push(demanda);
    }
    mapa.forEach((lista) => lista.sort(porOrdem));
    return mapa;
  });

  protected readonly filtrando = computed(() => this.somenteMinhas() || !!this.urgencia() || !!this.busca().trim());

  protected readonly visiveis = computed(() => {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    const urgencia = this.urgencia();
    const eu = this.meuId();
    const passa = (d: Demanda) =>
      (!this.somenteMinhas() || (!!eu && d.responsaveis.includes(eu))) &&
      (!urgencia || d.urgencia === urgencia) &&
      (!termo || `${d.titulo} ${d.descricao ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo));
    const mapa = new Map<StatusDemanda, Demanda[]>();
    this.porStatus().forEach((lista, status) => mapa.set(status, lista.filter(passa)));
    return mapa;
  });

  constructor() {
    effect(() => {
      const id = this.abrir();
      const demandas = this.demandas();
      if (id && demandas) {
        untracked(() => this.abrirPelaUrl(id, demandas));
      }
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.erro.set(false);
    forkJoin({ demandas: this.demandaService.listar(), opcoes: this.demandaService.responsaveis() })
      .pipe(
        finalize(() => this.carregando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ demandas, opcoes }) => {
          this.opcoes.set(opcoes);
          this.demandas.set(demandas);
        },
        error: () => this.erro.set(true),
      });
  }

  protected limparFiltros(): void {
    this.somenteMinhas.set(false);
    this.urgencia.set('');
    this.busca.set('');
  }

  /** Move na tela na hora e confirma com a API; se ela recusar, recarrega o quadro. */
  protected soltar(evento: CdkDragDrop<StatusDemanda, StatusDemanda, Demanda>): void {
    const demanda = evento.item.data;
    const destino = evento.container.data;
    if (evento.previousContainer.data === destino && evento.previousIndex === evento.currentIndex) {
      return;
    }
    const semEla = (lista: Demanda[]) => lista.filter((d) => d.id !== demanda.id);
    const completa = semEla(this.porStatus().get(destino) ?? []);
    const posicao = posicaoNaColuna(semEla(this.visiveis().get(destino) ?? []), completa, evento.currentIndex);

    const reordenada = [...completa];
    reordenada.splice(posicao, 0, { ...demanda, status: destino });
    const novaOrdem = new Map(reordenada.map((d, i) => [d.id, i]));
    this.demandas.update((lista) =>
      (lista ?? []).map((d) =>
        novaOrdem.has(d.id)
          ? {
              ...d,
              status: destino,
              ordem: novaOrdem.get(d.id)!,
              atrasada: d.id === demanda.id ? destino !== 'CONCLUIDO' && this.prazoPassou(d) : d.atrasada,
            }
          : d,
      ),
    );

    this.demandaService
      .mover(demanda.id, destino, posicao)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (salva) => this.substituir(salva),
        error: () => this.carregar(),
      });
  }

  protected nova(status: StatusDemanda = 'A_FAZER'): void {
    this.abrirFormulario({ status });
  }

  protected editar(demanda: Demanda): void {
    this.abrirFormulario({ demanda });
  }

  protected responsaveis(demanda: Demanda): UsuarioOpcao[] {
    const pessoas = this.pessoas();
    return demanda.responsaveis.map((id) => pessoas.get(id) ?? { id, nome: 'Usuário removido', avatarUrl: null });
  }

  protected progresso(demanda: Demanda): { feitos: number; total: number } | null {
    const total = demanda.checklist.length;
    return total ? { feitos: demanda.checklist.filter((i) => i.feito).length, total } : null;
  }

  private abrirFormulario(dados: Pick<DemandaFormData, 'demanda' | 'status'>): void {
    const demanda = dados.demanda;
    this.dialog
      .open<DemandaFormDialog, DemandaFormData, ResultadoDemandaForm>(DemandaFormDialog, {
        data: {
          ...dados,
          opcoes: this.opcoes(),
          podeExcluir: !!demanda && (this.auth.ehAdmin() || demanda.criadoPor === this.meuId()),
        },
        width: '640px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((resultado) => {
        if (resultado?.tipo === 'salva') {
          this.substituir(resultado.demanda);
          this.notificacao.sucesso(demanda ? 'Demanda atualizada.' : 'Demanda criada.');
        } else if (resultado?.tipo === 'excluida') {
          this.demandas.update((lista) => (lista ?? []).filter((d) => d.id !== resultado.id));
          this.notificacao.sucesso('Demanda excluída.');
        }
      });
  }

  private abrirPelaUrl(id: string, demandas: Demanda[]): void {
    this.router.navigate([], { queryParams: { abrir: null }, queryParamsHandling: 'merge', replaceUrl: true });
    const demanda = demandas.find((d) => d.id === id);
    if (demanda) {
      this.editar(demanda);
    } else {
      this.notificacao.aviso('Esta demanda não existe mais.');
    }
  }

  private substituir(salva: Demanda): void {
    this.demandas.update((lista) => {
      const atual = lista ?? [];
      return atual.some((d) => d.id === salva.id) ? atual.map((d) => (d.id === salva.id ? salva : d)) : [...atual, salva];
    });
  }

  private prazoPassou(demanda: Demanda): boolean {
    if (!demanda.prazo) {
      return false;
    }
    const hoje = new Date();
    const local = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    return demanda.prazo < local;
  }
}
