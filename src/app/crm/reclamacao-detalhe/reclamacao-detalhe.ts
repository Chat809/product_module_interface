import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { EMPTY, Observable, finalize, of, switchMap } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { UsuarioOpcao } from '../../demandas/demanda.model';
import { PainelAnexos } from '../../shared/anexos/painel-anexos';
import { SeletorMarcadores } from '../../shared/marcadores/seletor-marcadores';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { TextoDialog, TextoDialogData } from '../../shared/texto-dialog/texto-dialog';
import {
  CANAIS,
  PRIORIDADES,
  ROTULO_DO_STATUS,
  Reclamacao,
  ReclamacaoEvento,
  StatusReclamacao,
} from '../crm.model';
import { CrmService } from '../crm.service';

export interface ReclamacaoDetalheData {
  reclamacao: Reclamacao;
  pessoas: Map<string, UsuarioOpcao>;
  editar: (reclamacao: Reclamacao) => Observable<Reclamacao>;
}

const ACOES: Record<StatusReclamacao, { status: StatusReclamacao; rotulo: string; icone: string }[]> = {
  ABERTA: [
    { status: 'EM_ANALISE', rotulo: 'Iniciar análise', icone: 'manage_search' },
    { status: 'RESOLVIDA', rotulo: 'Resolver', icone: 'task_alt' },
  ],
  EM_ANALISE: [{ status: 'RESOLVIDA', rotulo: 'Resolver', icone: 'task_alt' }],
  RESOLVIDA: [
    { status: 'ENCERRADA', rotulo: 'Encerrar', icone: 'archive' },
    { status: 'ABERTA', rotulo: 'Reabrir', icone: 'undo' },
  ],
  ENCERRADA: [{ status: 'ABERTA', rotulo: 'Reabrir', icone: 'undo' }],
};

/**
 * Muda o status de uma reclamação; resolver pede a solução quando ainda não há uma. Usado pelo detalhe e
 * pelo arrasto no quadro.
 */
export function mudarStatus(
  dialog: MatDialog,
  crm: CrmService,
  reclamacao: Reclamacao,
  status: StatusReclamacao,
): Observable<Reclamacao> {
  const solucao$: Observable<string | null> =
    status === 'RESOLVIDA'
      ? dialog
          .open<TextoDialog, TextoDialogData, string>(TextoDialog, {
            data: {
              titulo: `Resolver ${reclamacao.protocolo}`,
              mensagem: 'Descreva o que foi feito. A solução fica registrada na reclamação.',
              rotulo: 'Solução',
              valor: reclamacao.solucao,
              obrigatorio: true,
              max: 4000,
              textoConfirmar: 'Resolver',
            },
          })
          .afterClosed()
          .pipe(switchMap((texto) => (texto ? of(texto) : EMPTY)))
      : of(null);
  return solucao$.pipe(switchMap((solucao) => crm.alterarStatus(reclamacao.id, status, solucao)));
}

/** Fecha com `true` quando a reclamação mudou, para a tela recarregar. */
@Component({
  selector: 'app-reclamacao-detalhe',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    PainelAnexos,
    SeletorMarcadores,
    Skeleton,
  ],
  template: `
    <header class="cabecalho">
      <div>
        <h2 mat-dialog-title>{{ reclamacao().protocolo }} · {{ reclamacao().assunto }}</h2>
        <p class="subtitulo">
          <span class="selo" [attr.data-status]="reclamacao().status">{{ rotulosDeStatus[reclamacao().status] }}</span>
          <span class="prioridade" [attr.data-prioridade]="reclamacao().prioridade">
            Prioridade {{ prioridades[reclamacao().prioridade].toLowerCase() }}
          </span>
        </p>
      </div>
      <button mat-icon-button type="button" aria-label="Fechar" [mat-dialog-close]="alterado">
        <mat-icon>close</mat-icon>
      </button>
    </header>
    <mat-dialog-content>
      <dl class="dados">
        <div><dt>Cliente</dt><dd>{{ reclamacao().cliente?.nome ?? reclamacao().nomeContato ?? '—' }}</dd></div>
        <div><dt>Contato</dt><dd>{{ reclamacao().contato || '—' }}</dd></div>
        <div><dt>Canal</dt><dd>{{ reclamacao().canal ? canais[reclamacao().canal!] : '—' }}</dd></div>
        <div><dt>Responsável</dt><dd>{{ nomeDe(reclamacao().responsavelId) ?? '—' }}</dd></div>
        <div>
          <dt>Prazo</dt>
          <dd [class.atrasada]="atrasada()">{{ reclamacao().prazo ? (reclamacao().prazo | date: 'dd/MM/yyyy') : '—' }}</dd>
        </div>
        <div><dt>Aberta em</dt><dd>{{ reclamacao().criadoEm | date: 'dd/MM/yyyy HH:mm' }}</dd></div>
      </dl>
      <h3>Descrição</h3>
      <p class="texto">{{ reclamacao().descricao }}</p>
      @if (reclamacao().solucao) {
        <h3>Solução</h3>
        <p class="texto solucao">{{ reclamacao().solucao }}</p>
      }
      <app-seletor-marcadores entidade="reclamacoes" [registroId]="reclamacao().id" />

      <div class="acoes">
        @for (acao of acoes(); track acao.status) {
          <button mat-flat-button type="button" [disabled]="ocupado()" (click)="alterar(acao.status)">
            <mat-icon>{{ acao.icone }}</mat-icon>
            {{ acao.rotulo }}
          </button>
        }
        <button mat-stroked-button type="button" (click)="editar()">
          <mat-icon>edit</mat-icon>
          Editar
        </button>
      </div>

      <h3>Arquivos</h3>
      <app-painel-anexos entidade="reclamacoes" [registroId]="reclamacao().id" />

      <h3>Histórico</h3>
      @if (historico() === null) {
        <app-skeleton [linhas]="3" />
      } @else {
        <ol class="historico">
          @for (evento of historico(); track evento.id) {
            <li>
              <mat-icon>{{ evento.tipo === 'COMENTARIO' ? 'chat_bubble_outline' : evento.tipo === 'CRIADA' ? 'flag' : 'swap_horiz' }}</mat-icon>
              <div>
                <p class="cabeca">
                  {{ evento.criadoEm | date: 'dd/MM/yyyy HH:mm' }}
                  @if (evento.autorId) {
                    · {{ nomeDe(evento.autorId) ?? 'Usuário removido' }}
                  }
                </p>
                <p class="linha">{{ descrever(evento) }}</p>
              </div>
            </li>
          }
        </ol>
      }
      <form class="comentario" (ngSubmit)="comentar()">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Comentário</mat-label>
          <textarea matInput name="comentario" rows="2" maxlength="2000" [(ngModel)]="comentario"></textarea>
        </mat-form-field>
        <button mat-stroked-button type="submit" [disabled]="!comentario.trim() || ocupado()">Comentar</button>
      </form>
    </mat-dialog-content>
  `,
  styles: `
    .cabecalho {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-right: 12px;

      h2 {
        padding-bottom: 0;
      }
    }

    .subtitulo {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 24px;
    }

    .selo {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--mat-sys-surface-container-highest);
      font: var(--mat-sys-label-small);

      &[data-status='ABERTA'] {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }

      &[data-status='RESOLVIDA'] {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
    }

    .prioridade {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);

      &[data-prioridade='ALTA'],
      &[data-prioridade='CRITICA'] {
        color: var(--mat-sys-error);
      }
    }

    .dados {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px 24px;
      margin: 8px 0 16px;

      dt {
        font: var(--mat-sys-label-small);
        color: var(--mat-sys-on-surface-variant);
      }

      dd {
        margin: 2px 0 0;
        overflow-wrap: anywhere;
      }
    }

    .atrasada {
      color: var(--mat-sys-error);
    }

    h3 {
      margin: 16px 0 4px;
      font: var(--mat-sys-title-small);
    }

    .texto {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .solucao {
      padding: 12px;
      border-radius: var(--app-raio);
      background: var(--mat-sys-surface-container-low);
    }

    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0;
    }

    .historico {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }

      mat-icon {
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .cabeca {
      margin: 0;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .linha {
      margin: 2px 0 0;
      white-space: pre-wrap;
    }

    .comentario {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      margin-top: 12px;

      mat-form-field {
        width: 100%;
      }
    }
  `,
})
export class ReclamacaoDetalhe implements OnInit {
  protected readonly data = inject<ReclamacaoDetalheData>(MAT_DIALOG_DATA);
  private readonly crm = inject(CrmService);
  private readonly dialog = inject(MatDialog);
  private readonly notificacao = inject(Notificacao);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rotulosDeStatus = ROTULO_DO_STATUS;
  protected readonly prioridades = PRIORIDADES;
  protected readonly canais = CANAIS;
  protected readonly reclamacao = signal(this.data.reclamacao);
  protected readonly historico = signal<ReclamacaoEvento[] | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly acoes = computed(() => ACOES[this.reclamacao().status]);
  protected readonly atrasada = computed(() => {
    const r = this.reclamacao();
    if (!r.prazo || r.status === 'RESOLVIDA' || r.status === 'ENCERRADA') {
      return false;
    }
    const hoje = new Date();
    const local = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    return r.prazo < local;
  });
  protected alterado = false;
  protected comentario = '';

  ngOnInit(): void {
    this.carregarHistorico();
  }

  protected nomeDe(id: string | null): string | null {
    return id ? (this.data.pessoas.get(id)?.nome ?? null) : null;
  }

  protected descrever(evento: ReclamacaoEvento): string {
    switch (evento.tipo) {
      case 'CRIADA':
        return 'Reclamação aberta.';
      case 'STATUS':
        return `Status: ${evento.statusAnterior ? ROTULO_DO_STATUS[evento.statusAnterior] : '—'} → ${
          evento.statusNovo ? ROTULO_DO_STATUS[evento.statusNovo] : '—'
        }`;
      default:
        return evento.comentario ?? '';
    }
  }

  protected alterar(status: StatusReclamacao): void {
    this.ocupado.set(true);
    mudarStatus(this.dialog, this.crm, this.reclamacao(), status)
      .pipe(
        finalize(() => this.ocupado.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((salva) => {
        this.reclamacao.set(salva);
        this.alterado = true;
        this.notificacao.sucesso(`Reclamação ${ROTULO_DO_STATUS[salva.status].toLowerCase()}.`);
        this.carregarHistorico();
      });
  }

  protected editar(): void {
    this.data.editar(this.reclamacao()).subscribe((salva) => {
      this.reclamacao.set(salva);
      this.alterado = true;
    });
  }

  protected comentar(): void {
    const texto = this.comentario.trim();
    if (!texto) {
      return;
    }
    this.ocupado.set(true);
    this.crm
      .comentar(this.reclamacao().id, texto)
      .pipe(
        finalize(() => this.ocupado.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((evento) => {
        this.historico.update((lista) => [...(lista ?? []), evento]);
        this.comentario = '';
      });
  }

  private carregarHistorico(): void {
    this.crm
      .historico(this.reclamacao().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (eventos) => this.historico.set(eventos), error: () => this.historico.set([]) });
  }
}
