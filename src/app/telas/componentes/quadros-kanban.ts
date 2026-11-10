import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin, switchMap } from 'rxjs';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { DialogosCadastro } from '../../shared/formulario-cadastro/dialogos-cadastro.service';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { data } from '../formatos';
import { OpcoesService } from '../opcoes.service';
import { Registro } from '../tela.model';

interface ColunaDoQuadro {
  id: string;
  nome: string;
  cor: string | null;
  limiteWip: number | null;
  demandas: Registro[];
}

/** Quadro Kanban com colunas próprias; arrastar muda a coluna (e o status equivalente) da demanda. */
@Component({
  selector: 'app-quadros-kanban',
  imports: [DragDropModule, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, Skeleton],
  template: `
    <header class="cabecalho">
      <div>
        <h1>Quadros</h1>
        <p class="subtitulo">Arraste as demandas entre as colunas. Configure quadros e colunas na outra aba.</p>
      </div>
      <div class="acoes">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Quadro</mat-label>
          <mat-select [ngModel]="quadroId()" (ngModelChange)="escolher($event)">
            @for (q of quadros(); track q['id']) {
              <mat-option [value]="q['id']">{{ q['nome'] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (quadroId()) {
          <button mat-stroked-button type="button" (click)="adicionar()">
            <mat-icon>add</mat-icon>
            Trazer demanda
          </button>
        }
      </div>
    </header>

    @if (carregando()) {
      <app-skeleton [linhas]="5" />
    } @else if (!quadros().length) {
      <p class="vazio">Nenhum quadro ativo. Crie um na aba "Configurar quadros".</p>
    } @else if (!colunas().length) {
      <p class="vazio">Este quadro ainda não tem colunas.</p>
    } @else {
      <div class="quadro" cdkDropListGroup>
        @for (coluna of colunas(); track coluna.id) {
          <section class="coluna" [style.--cor]="coluna.cor ?? 'var(--mat-sys-outline)'">
            <h2>
              {{ coluna.nome }}
              <span class="contagem" [class.estourou]="coluna.limiteWip && coluna.demandas.length > coluna.limiteWip">
                {{ coluna.demandas.length }}{{ coluna.limiteWip ? '/' + coluna.limiteWip : '' }}
              </span>
            </h2>
            <div class="lista" cdkDropList [cdkDropListData]="coluna" (cdkDropListDropped)="soltar($event)">
              @for (d of coluna.demandas; track d['id']) {
                <article class="cartao" cdkDrag [cdkDragData]="d">
                  <strong>{{ d['titulo'] }}</strong>
                  <span class="detalhe">
                    {{ urgencias[d['urgencia']] ?? d['urgencia'] }}
                    @if (d['prazo']) {
                      · prazo {{ formatar(d['prazo']) }}
                    }
                  </span>
                </article>
              }
            </div>
          </section>
        }
      </div>
    }
  `,
  styles: `
    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;

      h1 {
        margin: 0;
        font: var(--mat-sys-headline-small);
      }
    }

    .subtitulo {
      margin: 4px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .acoes {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .quadro {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(240px, 1fr);
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
    }

    .coluna {
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      border-top: 4px solid var(--cor);
      background: var(--mat-sys-surface-container-low);

      h2 {
        display: flex;
        justify-content: space-between;
        margin: 0;
        padding: 12px;
        font: var(--mat-sys-title-small);
      }
    }

    .contagem {
      color: var(--mat-sys-on-surface-variant);

      &.estourou {
        color: var(--mat-sys-error);
      }
    }

    .lista {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 120px;
      padding: 0 12px 12px;
    }

    .cartao {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border-radius: 8px;
      background: var(--mat-sys-surface);
      box-shadow: var(--mat-sys-level1);
      cursor: grab;
    }

    .detalhe,
    .vazio {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .cdk-drag-placeholder {
      opacity: 0.3;
    }
  `,
})
export class QuadrosKanban implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly dialogos = inject(DialogosCadastro);
  private readonly opcoes = inject(OpcoesService);

  protected readonly quadros = signal<Registro[]>([]);
  protected readonly quadroId = signal<string | null>(null);
  protected readonly colunas = signal<ColunaDoQuadro[]>([]);
  protected readonly carregando = signal(true);
  protected readonly formatar = data;
  protected readonly urgencias: Record<string, string> = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', URGENTE: 'Urgente' };
  private readonly primeiraColuna = computed(() => this.colunas()[0]?.id ?? null);

  ngOnInit(): void {
    this.supabase
      .executar<Registro[]>(() => this.supabase.cliente.from('quadros_kanban').select('*').eq('ativo', true).order('padrao', { ascending: false }).order('nome'))
      .subscribe({
        next: (quadros) => {
          this.quadros.set(quadros);
          if (quadros.length) {
            this.escolher(quadros[0]['id']);
          } else {
            this.carregando.set(false);
          }
        },
        error: () => this.carregando.set(false),
      });
  }

  protected escolher(id: string): void {
    this.quadroId.set(id);
    this.carregar();
  }

  protected soltar(evento: CdkDragDrop<ColunaDoQuadro>): void {
    const destino = evento.container.data;
    if (evento.previousContainer === evento.container) {
      if (evento.previousIndex === evento.currentIndex) {
        return;
      }
      moveItemInArray(destino.demandas, evento.previousIndex, evento.currentIndex);
    } else {
      transferArrayItem(evento.previousContainer.data.demandas, destino.demandas, evento.previousIndex, evento.currentIndex);
    }
    this.colunas.update((c) => [...c]);
    this.supabase
      .rpc('mover_demanda_coluna', { p_id: evento.item.data['id'], p_coluna_id: destino.id, p_posicao: evento.currentIndex })
      .subscribe({ error: () => this.carregar() });
  }

  protected adicionar(): void {
    const quadro = this.quadroId();
    const coluna = this.primeiraColuna();
    if (!quadro || !coluna) {
      return;
    }
    this.supabase
      .executar<Registro[]>(() =>
        this.supabase.cliente.from('demandas').select('id, titulo').is('quadro_id', null).neq('status', 'CONCLUIDO').order('criado_em', { ascending: false }).limit(500),
      )
      .pipe(
        switchMap((livres) =>
          this.dialogos.formulario(
            {
              titulo: 'Trazer demanda para o quadro',
              campos: [
                {
                  chave: 'demandaId',
                  rotulo: 'Demanda (sem quadro)',
                  tipo: 'select',
                  obrigatorio: true,
                  opcoes: livres.map((d) => ({ valor: d['id'], rotulo: d['titulo'] })),
                },
              ],
              textoSalvar: 'Trazer',
              salvar: (d) =>
                this.supabase.executar(() =>
                  this.supabase.cliente.from('demandas').update({ quadro_id: quadro, coluna_id: coluna }).eq('id', d['demandaId']).select().single(),
                ),
            },
            'Demanda adicionada ao quadro.',
          ),
        ),
      )
      .subscribe(() => {
        this.opcoes.limpar();
        this.carregar();
      });
  }

  private carregar(): void {
    const quadro = this.quadroId();
    if (!quadro) {
      return;
    }
    this.carregando.set(true);
    forkJoin({
      colunas: this.supabase.executar<Registro[]>(() =>
        this.supabase.cliente.from('quadro_kanban_colunas').select('*').eq('quadro_id', quadro).order('ordem'),
      ),
      demandas: this.supabase.executar<Registro[]>(() =>
        this.supabase.cliente
          .from('demandas')
          .select('id, titulo, urgencia, prazo, coluna_id, ordem')
          .eq('quadro_id', quadro)
          .order('ordem')
          .order('criado_em'),
      ),
    }).subscribe({
      next: ({ colunas, demandas }) => {
        const primeira = colunas[0]?.['id'];
        this.colunas.set(
          colunas.map((c) => ({
            id: c['id'],
            nome: c['nome'],
            cor: c['cor'],
            limiteWip: c['limiteWip'],
            demandas: demandas.filter((d) => (d['colunaId'] ?? primeira) === c['id']),
          })),
        );
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }
}
