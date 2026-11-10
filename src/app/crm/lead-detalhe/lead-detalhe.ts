import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Observable } from 'rxjs';
import { UsuarioOpcao } from '../../demandas/demanda.model';
import { PainelAnexos } from '../../shared/anexos/painel-anexos';
import { HistoricoAuditoria } from '../../shared/auditoria/historico-auditoria';
import { SeletorMarcadores } from '../../shared/marcadores/seletor-marcadores';
import { CrmEtapa, CrmOrigem, Lead, TipoInteracao } from '../crm.model';
import { CrmService } from '../crm.service';
import { Interacoes } from '../interacoes/interacoes';

export interface LeadDetalheData {
  lead: Lead;
  etapas: CrmEtapa[];
  origens: CrmOrigem[];
  pessoas: Map<string, UsuarioOpcao>;
  editar: (lead: Lead) => Observable<Lead>;
  converter: (lead: Lead) => Observable<Lead>;
  excluir: (lead: Lead) => Observable<void>;
}

/** Fecha com `true` quando o lead mudou (edição, conversão ou exclusão), para a tela recarregar. */
@Component({
  selector: 'app-lead-detalhe',
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatTabsModule,
    HistoricoAuditoria,
    Interacoes,
    PainelAnexos,
    SeletorMarcadores,
  ],
  template: `
    <header class="cabecalho">
      <div>
        <h2 mat-dialog-title>{{ lead().nome }}</h2>
        <p class="subtitulo">
          @if (etapa(); as e) {
            <span class="etapa" [style.--cor]="e.cor">{{ e.nome }}</span>
          }
          @if (lead().empresa) {
            {{ lead().empresa }}
          }
        </p>
      </div>
      <button mat-icon-button type="button" aria-label="Fechar" [mat-dialog-close]="alterado">
        <mat-icon>close</mat-icon>
      </button>
    </header>
    <mat-dialog-content>
      <mat-tab-group animationDuration="0ms" mat-stretch-tabs="false">
        <mat-tab label="Dados">
          @if (lead().clienteId) {
            <p class="convertido">
              <mat-icon>how_to_reg</mat-icon>
              Convertido em cliente em {{ lead().convertidoEm | date: 'dd/MM/yyyy' }}.
            </p>
          }
          <dl class="dados">
            <div><dt>E-mail</dt><dd>{{ lead().email || '—' }}</dd></div>
            <div><dt>Telefone</dt><dd>{{ lead().telefone || '—' }}</dd></div>
            <div><dt>Origem</dt><dd>{{ origem() || '—' }}</dd></div>
            <div>
              <dt>Valor estimado</dt>
              <dd>{{ lead().valorEstimado !== null ? (lead().valorEstimado | currency: 'BRL') : '—' }}</dd>
            </div>
            <div><dt>Responsável</dt><dd>{{ responsavel() || '—' }}</dd></div>
            <div>
              <dt>Próxima ação</dt>
              <dd>
                {{ lead().proximaAcao || '—' }}
                @if (lead().proximaAcaoEm) {
                  ({{ lead().proximaAcaoEm | date: 'dd/MM/yyyy' }})
                }
              </dd>
            </div>
            @if (lead().motivoPerda) {
              <div><dt>Motivo da perda</dt><dd>{{ lead().motivoPerda }}</dd></div>
            }
            <div><dt>Criado em</dt><dd>{{ lead().criadoEm | date: 'dd/MM/yyyy HH:mm' }}</dd></div>
            @if (campanha()) {
              <div><dt>Campanha (UTM)</dt><dd>{{ campanha() }}</dd></div>
            }
          </dl>
          @if (lead().observacoes) {
            <p class="observacoes">{{ lead().observacoes }}</p>
          }
          <app-seletor-marcadores entidade="leads" [registroId]="lead().id" />
          <div class="acoes">
            <button mat-stroked-button type="button" (click)="editar()">
              <mat-icon>edit</mat-icon>
              Editar
            </button>
            @if (!lead().clienteId) {
              <button mat-flat-button type="button" (click)="converter()">
                <mat-icon>how_to_reg</mat-icon>
                Converter em cliente
              </button>
            }
            <span class="espaco"></span>
            <button mat-button type="button" class="perigo" (click)="excluir()">
              <mat-icon>delete</mat-icon>
              Excluir
            </button>
          </div>
        </mat-tab>
        <mat-tab label="Interações">
          <ng-template matTabContent>
            <app-interacoes [carregar]="carregarInteracoes" [salvar]="registrarInteracao" [pessoas]="data.pessoas" />
          </ng-template>
        </mat-tab>
        <mat-tab label="Arquivos">
          <ng-template matTabContent>
            <app-painel-anexos entidade="leads" [registroId]="lead().id" />
          </ng-template>
        </mat-tab>
        <mat-tab label="Histórico">
          <ng-template matTabContent>
            <app-historico-auditoria tabela="leads" [registroId]="lead().id" />
          </ng-template>
        </mat-tab>
      </mat-tab-group>
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
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .etapa {
      padding: 2px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--cor) 18%, transparent);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-small);
    }

    mat-dialog-content {
      min-height: 340px;
    }

    .convertido {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 16px 0 0;
      color: var(--mat-sys-primary);
    }

    .dados {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px 24px;
      margin: 16px 0;

      dt {
        font: var(--mat-sys-label-small);
        color: var(--mat-sys-on-surface-variant);
      }

      dd {
        margin: 2px 0 0;
        overflow-wrap: anywhere;
      }
    }

    .observacoes {
      white-space: pre-wrap;
      padding: 12px;
      border-radius: var(--app-raio);
      background: var(--mat-sys-surface-container-low);
    }

    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .espaco {
      flex: 1;
    }

    .perigo {
      color: var(--mat-sys-error);
    }
  `,
})
export class LeadDetalhe {
  protected readonly data = inject<LeadDetalheData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<LeadDetalhe, boolean>>(MatDialogRef);
  private readonly crm = inject(CrmService);

  protected readonly lead = signal(this.data.lead);
  protected alterado = false;

  protected readonly etapa = computed(() => this.data.etapas.find((e) => e.id === this.lead().etapaId));
  protected readonly origem = computed(() => this.data.origens.find((o) => o.id === this.lead().origemId)?.nome);
  protected readonly campanha = computed(() => {
    const l = this.lead();
    return [l.utmSource, l.utmMedium, l.utmCampaign, l.utmTerm, l.utmContent].filter(Boolean).join(' · ');
  });
  protected readonly responsavel = computed(() => {
    const id = this.lead().responsavelId;
    return id ? (this.data.pessoas.get(id)?.nome ?? 'Usuário removido') : null;
  });

  protected readonly carregarInteracoes = () => this.crm.interacoesDoLead(this.data.lead.id);
  protected readonly registrarInteracao = (tipo: TipoInteracao, descricao: string) =>
    this.crm.registrarInteracaoNoLead(this.data.lead.id, tipo, descricao);

  protected editar(): void {
    this.data.editar(this.lead()).subscribe((salvo) => this.atualizar(salvo));
  }

  protected converter(): void {
    this.data.converter(this.lead()).subscribe((salvo) => this.atualizar(salvo));
  }

  protected excluir(): void {
    this.data.excluir(this.lead()).subscribe(() => this.dialogRef.close(true));
  }

  private atualizar(lead: Lead): void {
    this.lead.set(lead);
    this.alterado = true;
  }
}
