import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrmEtapa, CrmOrigem, TIPOS_DE_ETAPA, opcoesDe } from '../../crm/crm.model';
import { CrmService } from '../../crm/crm.service';
import { DialogosCadastro } from '../../shared/formulario-cadastro/dialogos-cadastro.service';
import { CampoCadastro } from '../../shared/formulario-cadastro/formulario-cadastro';
import { Skeleton } from '../../shared/skeleton/skeleton';

const CAMPOS_DA_ETAPA: CampoCadastro[] = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 40, meia: true },
  {
    chave: 'tipo',
    rotulo: 'Tipo',
    tipo: 'select',
    obrigatorio: true,
    meia: true,
    opcoes: opcoesDe(TIPOS_DE_ETAPA),
    dica: 'A conversão em cliente leva o lead à primeira etapa de ganho',
  },
  { chave: 'ordem', rotulo: 'Posição no funil', tipo: 'numero', min: 0, max: 999, meia: true },
  { chave: 'cor', rotulo: 'Cor', tipo: 'cor', meia: true },
  { chave: 'ativo', rotulo: 'Ativa (aparece no funil)', tipo: 'toggle' },
];

const CAMPOS_DA_ORIGEM: CampoCadastro[] = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 40 },
  { chave: 'ativo', rotulo: 'Ativa (aparece no cadastro de leads)', tipo: 'toggle' },
];

/** Configurações > Parâmetros do CRM: etapas do funil e origens de leads. */
@Component({
  selector: 'app-parametros-crm',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, Skeleton],
  template: `
    <header class="cabecalho">
      <h1>Parâmetros do CRM</h1>
      <p class="subtitulo">Itens em uso não podem ser excluídos: inative-os para tirá-los das listas.</p>
    </header>

    <div class="grade">
      <section class="cartao">
        <header>
          <div>
            <h2>Etapas do funil</h2>
            <p>Colunas do funil de leads, da esquerda para a direita.</p>
          </div>
          <button mat-flat-button type="button" (click)="editarEtapa()">
            <mat-icon>add</mat-icon>
            Nova etapa
          </button>
        </header>
        @if (etapas() === null) {
          <app-skeleton [linhas]="4" />
        } @else {
          <ul>
            @for (etapa of etapas(); track etapa.id) {
              <li [class.inativo]="!etapa.ativo">
                <span class="cor" [style.background]="etapa.cor"></span>
                <span class="nome">
                  {{ etapa.nome }}
                  <small>{{ tipos[etapa.tipo] }} · posição {{ etapa.ordem }}{{ etapa.ativo ? '' : ' · inativa' }}</small>
                </span>
                <button mat-icon-button type="button" matTooltip="Editar" aria-label="Editar" (click)="editarEtapa(etapa)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" matTooltip="Excluir" aria-label="Excluir" (click)="excluirEtapa(etapa)">
                  <mat-icon>delete</mat-icon>
                </button>
              </li>
            } @empty {
              <li class="vazio">Nenhuma etapa. Crie ao menos uma etapa em andamento e uma de ganho.</li>
            }
          </ul>
        }
      </section>

      <section class="cartao">
        <header>
          <div>
            <h2>Origens de leads</h2>
            <p>De onde vêm os contatos (site, indicação, redes...).</p>
          </div>
          <button mat-flat-button type="button" (click)="editarOrigem()">
            <mat-icon>add</mat-icon>
            Nova origem
          </button>
        </header>
        @if (origens() === null) {
          <app-skeleton [linhas]="4" />
        } @else {
          <ul>
            @for (origem of origens(); track origem.id) {
              <li [class.inativo]="!origem.ativo">
                <span class="nome">
                  {{ origem.nome }}
                  @if (!origem.ativo) {
                    <small>inativa</small>
                  }
                </span>
                <button mat-icon-button type="button" matTooltip="Editar" aria-label="Editar" (click)="editarOrigem(origem)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" matTooltip="Excluir" aria-label="Excluir" (click)="excluirOrigem(origem)">
                  <mat-icon>delete</mat-icon>
                </button>
              </li>
            } @empty {
              <li class="vazio">Nenhuma origem cadastrada.</li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: `
    .cabecalho {
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

    .grade {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
      align-items: start;
    }

    .cartao {
      padding: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;

      > header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      h2 {
        margin: 0;
        font: var(--mat-sys-title-medium);
      }

      header p {
        margin: 4px 0 0;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }
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
      padding: 4px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);

      &.inativo .nome {
        color: var(--mat-sys-on-surface-variant);
      }

      &.vazio {
        padding: 16px 0;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .cor {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      border-radius: 50%;
    }

    .nome {
      flex: 1;

      small {
        display: block;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }
    }
  `,
})
export class ParametrosCrm implements OnInit {
  private readonly crm = inject(CrmService);
  private readonly dialogos = inject(DialogosCadastro);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tipos = TIPOS_DE_ETAPA;
  protected readonly etapas = signal<CrmEtapa[] | null>(null);
  protected readonly origens = signal<CrmOrigem[] | null>(null);

  ngOnInit(): void {
    this.carregarEtapas();
    this.carregarOrigens();
  }

  protected editarEtapa(etapa?: CrmEtapa): void {
    const proxima = Math.max(0, ...(this.etapas() ?? []).map((e) => e.ordem)) + 1;
    this.dialogos
      .formulario(
        {
          titulo: etapa ? 'Editar etapa' : 'Nova etapa',
          campos: CAMPOS_DA_ETAPA,
          valores: etapa ? { ...etapa } : { tipo: 'ABERTA', ordem: proxima, cor: '#0ea5e9' },
          salvar: (dados) => this.crm.salvarEtapa(etapa?.id ?? null, dados),
        },
        etapa ? 'Etapa atualizada.' : 'Etapa criada.',
      )
      .subscribe(() => this.carregarEtapas());
  }

  protected excluirEtapa(etapa: CrmEtapa): void {
    this.dialogos
      .excluir(`A etapa "${etapa.nome}"`, () => this.crm.excluirEtapa(etapa.id))
      .subscribe(() => this.carregarEtapas());
  }

  protected editarOrigem(origem?: CrmOrigem): void {
    this.dialogos
      .formulario(
        {
          titulo: origem ? 'Editar origem' : 'Nova origem',
          campos: CAMPOS_DA_ORIGEM,
          valores: origem ? { ...origem } : undefined,
          salvar: (dados) => this.crm.salvarOrigem(origem?.id ?? null, dados),
        },
        origem ? 'Origem atualizada.' : 'Origem criada.',
      )
      .subscribe(() => this.carregarOrigens());
  }

  protected excluirOrigem(origem: CrmOrigem): void {
    this.dialogos
      .excluir(`A origem "${origem.nome}"`, () => this.crm.excluirOrigem(origem.id))
      .subscribe(() => this.carregarOrigens());
  }

  private carregarEtapas(): void {
    this.crm
      .etapas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (etapas) => this.etapas.set(etapas), error: () => this.etapas.set([]) });
  }

  private carregarOrigens(): void {
    this.crm
      .origens()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (origens) => this.origens.set(origens), error: () => this.origens.set([]) });
  }
}
