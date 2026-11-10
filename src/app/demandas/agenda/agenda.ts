import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { DialogosCadastro } from '../../shared/formulario-cadastro/dialogos-cadastro.service';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { hojeIso, opcoes, somarDias } from '../../telas/formatos';
import { OpcoesService } from '../../telas/opcoes.service';
import { CampoTela, Registro } from '../../telas/tela.model';

interface ItemDaAgenda {
  origem: 'COMPROMISSO' | 'DEMANDA' | 'CONTA_PAGAR' | 'CONTA_RECEBER' | 'LEAD' | string;
  registroId: string;
  titulo: string;
  inicio: string;
  fim: string | null;
  diaInteiro: boolean;
  responsavelId: string | null;
  link: string;
}

const ORIGENS: Record<string, { rotulo: string; icone: string }> = {
  COMPROMISSO: { rotulo: 'Compromisso', icone: 'event' },
  DEMANDA: { rotulo: 'Prazo de demanda', icone: 'task_alt' },
  CONTA_PAGAR: { rotulo: 'Conta a pagar', icone: 'arrow_upward' },
  CONTA_RECEBER: { rotulo: 'Conta a receber', icone: 'arrow_downward' },
  LEAD: { rotulo: 'Próxima ação de lead', icone: 'person_search' },
};

const TIPOS: Record<string, string> = { REUNIAO: 'Reunião', VISITA: 'Visita', LIGACAO: 'Ligação', TAREFA: 'Tarefa', OUTRO: 'Outro' };

const CAMPOS: CampoTela[] = [
  { chave: 'titulo', rotulo: 'Título', obrigatorio: true, max: 150, meia: true },
  { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(TIPOS) },
  { chave: 'inicio', rotulo: 'Início', tipo: 'datahora', obrigatorio: true, meia: true },
  { chave: 'fim', rotulo: 'Fim', tipo: 'datahora', meia: true },
  { chave: 'diaInteiro', rotulo: 'Dia inteiro', tipo: 'toggle' },
  { chave: 'local', rotulo: 'Local ou link da reunião', max: 300 },
  { chave: 'responsavelId', rotulo: 'Responsável', tipo: 'select', meia: true, fonte: { usuarios: true } },
  { chave: 'participantes', rotulo: 'Participantes', tipo: 'multipla', meia: true, fonte: { usuarios: true } },
  { chave: 'clienteId', rotulo: 'Cliente', tipo: 'select', meia: true, fonte: { tabela: 'clientes', filtro: { ativo: true } } },
  { chave: 'leadId', rotulo: 'Lead', tipo: 'select', meia: true, fonte: { tabela: 'leads' } },
  { chave: 'lembreteMinutos', rotulo: 'Lembrar quantos minutos antes', tipo: 'numero', min: 0, max: 10080, meia: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea', max: 4000 },
];

/** Compromissos e tudo que tem data no sistema (prazos, vencimentos, próximas ações), dia a dia. */
@Component({
  selector: 'app-agenda',
  imports: [FormsModule, MatButtonModule, MatButtonToggleModule, MatIconModule, MatSlideToggleModule, MatTooltipModule, Skeleton],
  template: `
    <header class="cabecalho">
      <div>
        <h1>Agenda</h1>
        <p class="subtitulo">Compromissos, prazos de demandas, vencimentos e próximas ações de leads.</p>
      </div>
      <button mat-flat-button type="button" (click)="editar()">
        <mat-icon>add</mat-icon>
        Novo compromisso
      </button>
    </header>

    <section class="filtros">
      <button mat-icon-button type="button" aria-label="Período anterior" (click)="andar(-1)"><mat-icon>chevron_left</mat-icon></button>
      <button mat-stroked-button type="button" (click)="irParaHoje()">Hoje</button>
      <button mat-icon-button type="button" aria-label="Próximo período" (click)="andar(1)"><mat-icon>chevron_right</mat-icon></button>
      <span class="periodo">{{ rotuloDoPeriodo() }}</span>
      <mat-button-toggle-group [value]="dias()" (change)="mudarDias($event.value)" hideSingleSelectionIndicator aria-label="Período">
        <mat-button-toggle [value]="7">Semana</mat-button-toggle>
        <mat-button-toggle [value]="30">30 dias</mat-button-toggle>
      </mat-button-toggle-group>
      <mat-slide-toggle [ngModel]="soMeus()" (ngModelChange)="soMeus.set($event)">Só os meus</mat-slide-toggle>
    </section>

    @if (itens() === null) {
      <app-skeleton [linhas]="6" />
    } @else if (!porDia().length) {
      <p class="vazio">Nada na agenda neste período.</p>
    } @else {
      @for (grupo of porDia(); track grupo.dia) {
        <section class="dia" [class.hoje]="grupo.dia === hoje">
          <h2>{{ grupo.rotulo }}</h2>
          <ul>
            @for (item of grupo.itens; track item.origem + item.registroId) {
              <li>
                <mat-icon class="icone" [attr.data-origem]="item.origem">{{ origens[item.origem]?.icone ?? 'event' }}</mat-icon>
                <span class="hora">{{ item.diaInteiro ? 'Dia todo' : hora(item.inicio) }}</span>
                <div class="texto">
                  <strong>{{ item.titulo }}</strong>
                  <span class="detalhe">
                    {{ origens[item.origem]?.rotulo ?? item.origem }}
                    @if (item.responsavelId) {
                      · {{ nomeDe(item.responsavelId) }}
                    }
                  </span>
                </div>
                @if (item.origem === 'COMPROMISSO') {
                  <button mat-icon-button type="button" matTooltip="Editar" aria-label="Editar" (click)="editar(item.registroId)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button type="button" matTooltip="Excluir" aria-label="Excluir" (click)="excluir(item)">
                    <mat-icon>delete</mat-icon>
                  </button>
                } @else {
                  <button mat-icon-button type="button" matTooltip="Abrir" aria-label="Abrir" (click)="abrir(item)">
                    <mat-icon>open_in_new</mat-icon>
                  </button>
                }
              </li>
            }
          </ul>
        </section>
      }
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

    .filtros {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .periodo {
      font: var(--mat-sys-title-small);
      margin-right: auto;
    }

    .dia {
      margin-bottom: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      overflow: hidden;

      &.hoje {
        border-color: var(--mat-sys-primary);
      }

      h2 {
        margin: 0;
        padding: 10px 16px;
        font: var(--mat-sys-title-small);
        background: var(--mat-sys-surface-container-low);
      }

      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
    }

    .icone {
      color: var(--mat-sys-primary);

      &[data-origem='CONTA_PAGAR'] {
        color: var(--mat-sys-error);
      }
    }

    .hora {
      min-width: 64px;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .texto {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .detalhe,
    .vazio {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class Agenda implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly dialogos = inject(DialogosCadastro);
  private readonly opcoesService = inject(OpcoesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly hoje = hojeIso();
  protected readonly origens = ORIGENS;
  protected readonly inicio = signal(this.hoje);
  protected readonly dias = signal(7);
  protected readonly soMeus = signal(false);
  protected readonly itens = signal<ItemDaAgenda[] | null>(null);
  private readonly pessoas = signal(new Map<string, string>());

  protected readonly rotuloDoPeriodo = computed(() => {
    const formatar = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
    return `${formatar(this.inicio())} a ${formatar(somarDias(this.inicio(), this.dias() - 1))}`;
  });

  protected readonly porDia = computed(() => {
    const eu = this.auth.usuario()?.id;
    const grupos = new Map<string, ItemDaAgenda[]>();
    for (const item of this.itens() ?? []) {
      if (this.soMeus() && item.responsavelId !== eu) {
        continue;
      }
      // Prazos e vencimentos são datas sem hora: a view os entrega à meia-noite UTC.
      const dia = item.origem !== 'COMPROMISSO' && item.diaInteiro ? item.inicio.slice(0, 10) : this.diaLocal(item.inicio);
      if (dia < this.inicio() || dia >= somarDias(this.inicio(), this.dias())) {
        continue;
      }
      grupos.set(dia, [...(grupos.get(dia) ?? []), item]);
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, itens]) => ({
        dia,
        rotulo: new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
        itens: itens.sort((a, b) => Number(b.diaInteiro) - Number(a.diaInteiro) || a.inicio.localeCompare(b.inicio)),
      }));
  });

  ngOnInit(): void {
    this.opcoesService
      .usuarios()
      .pipe(catchError(() => of([])))
      .subscribe((lista) => this.pessoas.set(new Map(lista.map((p) => [p.id, p.nome]))));
    this.carregar();
  }

  protected nomeDe(id: string): string {
    return this.pessoas().get(id) ?? 'Usuário removido';
  }

  protected hora(iso: string): string {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  protected andar(passo: number): void {
    this.inicio.set(somarDias(this.inicio(), passo * this.dias()));
    this.carregar();
  }

  protected irParaHoje(): void {
    this.inicio.set(this.hoje);
    this.carregar();
  }

  protected mudarDias(dias: number): void {
    this.dias.set(dias);
    this.carregar();
  }

  protected abrir(item: ItemDaAgenda): void {
    this.router.navigateByUrl(item.link);
  }

  protected editar(id?: string): void {
    const registro$: Observable<Registro | null> = id
      ? this.supabase.executar<Registro>(() => this.supabase.cliente.from('compromissos_agenda').select('*').eq('id', id).single())
      : of(null);
    registro$
      .pipe(
        switchMap((registro) =>
          this.opcoesService.resolver(CAMPOS).pipe(
            switchMap((campos) =>
              this.dialogos.formulario(
                {
                  titulo: registro ? 'Editar compromisso' : 'Novo compromisso',
                  campos,
                  valores: registro ?? { tipo: 'REUNIAO', diaInteiro: false, responsavelId: this.auth.usuario()?.id, participantes: [] },
                  salvar: (dados) => {
                    const linha = this.supabase.paraSnake({ ...dados, participantes: dados['participantes'] ?? [] });
                    return this.supabase.executar<Registro>(() =>
                      registro
                        ? this.supabase.cliente.from('compromissos_agenda').update(linha).eq('id', registro['id']).select().single()
                        : this.supabase.cliente.from('compromissos_agenda').insert(linha).select().single(),
                    );
                  },
                },
                registro ? 'Compromisso atualizado.' : 'Compromisso criado.',
              ),
            ),
          ),
        ),
      )
      .subscribe(() => this.carregar());
  }

  protected excluir(item: ItemDaAgenda): void {
    this.dialogos
      .excluir(`O compromisso "${item.titulo}"`, () =>
        this.supabase
          .executar(() => this.supabase.cliente.from('compromissos_agenda').delete().eq('id', item.registroId))
          .pipe(map(() => undefined)),
      )
      .subscribe(() => this.carregar());
  }

  private diaLocal(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private carregar(): void {
    this.itens.set(null);
    const de = new Date(`${somarDias(this.inicio(), -1)}T00:00:00`).toISOString();
    const ate = new Date(`${somarDias(this.inicio(), this.dias() + 1)}T00:00:00`).toISOString();
    this.supabase
      .executar<ItemDaAgenda[]>(() =>
        this.supabase.cliente.from('agenda_consolidada').select('*').gte('inicio', de).lt('inicio', ate).order('inicio').limit(1000),
      )
      .subscribe({ next: (lista) => this.itens.set(lista), error: () => this.itens.set([]) });
  }
}
