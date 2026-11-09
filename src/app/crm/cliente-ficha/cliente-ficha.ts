import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Observable, catchError, map, of } from 'rxjs';
import { UsuarioOpcao } from '../../demandas/demanda.model';
import { Conta, formatarDocumento } from '../../financeiro/financeiro.model';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { Cliente, ROTULO_DO_STATUS, Reclamacao, TipoInteracao } from '../crm.model';
import { CrmService } from '../crm.service';
import { Interacoes } from '../interacoes/interacoes';

export interface ClienteFichaData {
  cliente: Cliente;
  pessoas: Map<string, UsuarioOpcao>;
  podeEditar: boolean;
  podeVerFinanceiro: boolean;
  /** Abre o formulário de edição e emite o cliente salvo. */
  editar: (cliente: Cliente) => Observable<Cliente>;
}

/** Ficha do cliente: dados, interações, reclamações e contas a receber. */
@Component({
  selector: 'app-cliente-ficha',
  imports: [CurrencyPipe, DatePipe, MatButtonModule, MatDialogModule, MatIconModule, MatTabsModule, Interacoes, Skeleton],
  template: `
    <header class="cabecalho">
      <div>
        <h2 mat-dialog-title>{{ cliente().nome }}</h2>
        <p class="subtitulo">
          {{ cliente().tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física' }}
          @if (!cliente().ativo) {
            · Inativo
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
          <dl class="dados">
            @for (linha of dados(); track linha[0]) {
              <div>
                <dt>{{ linha[0] }}</dt>
                <dd>{{ linha[1] || '—' }}</dd>
              </div>
            }
          </dl>
          @if (cliente().observacoes) {
            <p class="observacoes">{{ cliente().observacoes }}</p>
          }
          @if (data.podeEditar) {
            <button mat-stroked-button type="button" (click)="editar()">
              <mat-icon>edit</mat-icon>
              Editar dados
            </button>
          }
        </mat-tab>
        <mat-tab label="Interações">
          <ng-template matTabContent>
            <app-interacoes
              [carregar]="carregarInteracoes"
              [salvar]="registrarInteracao"
              [pessoas]="data.pessoas"
              [podeRegistrar]="data.podeEditar"
            />
          </ng-template>
        </mat-tab>
        <mat-tab label="Reclamações">
          <ng-template matTabContent>
            @if (reclamacoes() === null) {
              <app-skeleton [linhas]="3" />
            } @else if (reclamacoes()!.length === 0) {
              <p class="vazio">Nenhuma reclamação deste cliente.</p>
            } @else {
              <ul class="lista">
                @for (r of reclamacoes(); track r.id) {
                  <li>
                    <div>
                      <strong>{{ r.protocolo }}</strong> · {{ r.assunto }}
                      <span class="detalhe">Aberta em {{ r.criadoEm | date: 'dd/MM/yyyy' }}</span>
                    </div>
                    <span class="selo" [attr.data-status]="r.status">{{ rotulosDeStatus[r.status] }}</span>
                  </li>
                }
              </ul>
            }
          </ng-template>
        </mat-tab>
        @if (data.podeVerFinanceiro) {
          <mat-tab label="Financeiro">
            <ng-template matTabContent>
              @if (contas() === null) {
                <app-skeleton [linhas]="3" />
              } @else if (contas()!.length === 0) {
                <p class="vazio">Nenhuma conta a receber ligada a este cliente.</p>
              } @else {
                <div class="totais">
                  <div>
                    <span>Em aberto</span>
                    <strong>{{ totais().aberto | currency: 'BRL' }}</strong>
                  </div>
                  <div>
                    <span>Recebido</span>
                    <strong>{{ totais().recebido | currency: 'BRL' }}</strong>
                  </div>
                </div>
                <ul class="lista">
                  @for (c of contas(); track c.id) {
                    <li>
                      <div>
                        {{ c.descricao }}
                        <span class="detalhe">Vence em {{ c.vencimento | date: 'dd/MM/yyyy' }}</span>
                      </div>
                      <div class="valor">
                        {{ c.valorLiquido | currency: 'BRL' }}
                        <span class="detalhe" [class.vencida]="c.vencida">
                          {{ c.status === 'RECEBIDO' ? 'Recebida' : c.status === 'CANCELADO' ? 'Cancelada' : c.vencida ? 'Vencida' : 'Pendente' }}
                        </span>
                      </div>
                    </li>
                  }
                </ul>
              }
            </ng-template>
          </mat-tab>
        }
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
      margin: 0 24px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    mat-dialog-content {
      min-height: 360px;
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

    .lista {
      margin: 16px 0 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }

    .detalhe {
      display: block;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);

      &.vencida {
        color: var(--mat-sys-error);
      }
    }

    .valor {
      text-align: right;
      white-space: nowrap;
    }

    .selo {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--mat-sys-surface-container-highest);
      font: var(--mat-sys-label-small);
      white-space: nowrap;

      &[data-status='ABERTA'] {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }

      &[data-status='RESOLVIDA'] {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
    }

    .totais {
      display: flex;
      gap: 24px;
      margin-top: 16px;

      div {
        display: flex;
        flex-direction: column;
      }

      span {
        font: var(--mat-sys-label-small);
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .vazio {
      margin-top: 16px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ClienteFicha {
  protected readonly data = inject<ClienteFichaData>(MAT_DIALOG_DATA);
  private readonly crm = inject(CrmService);

  protected readonly cliente = signal(this.data.cliente);
  protected readonly rotulosDeStatus = ROTULO_DO_STATUS;
  /** Devolvido ao fechar, para a lista recarregar quando a ficha editou o cliente. */
  protected alterado = false;

  protected readonly dados = computed(() => {
    const c = this.cliente();
    const endereco = [c.endereco, c.cidade && c.uf ? `${c.cidade}/${c.uf}` : (c.cidade ?? c.uf)].filter(Boolean).join(' · ');
    return [
      [c.tipo === 'PJ' ? 'CNPJ' : 'CPF', formatarDocumento(c.documento)],
      ['E-mail', c.email],
      ['Telefone', c.telefone],
      ['Nascimento', c.dataNascimento ? c.dataNascimento.split('-').reverse().join('/') : null],
      ['CEP', c.cep ? c.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : null],
      ['Endereço', endereco],
      ['Origem', c.origem],
      ['Responsável', c.responsavelId ? (this.data.pessoas.get(c.responsavelId)?.nome ?? 'Usuário removido') : null],
    ] as [string, string | null][];
  });

  protected readonly carregarInteracoes = () => this.crm.interacoesDoCliente(this.data.cliente.id);
  protected readonly registrarInteracao = (tipo: TipoInteracao, descricao: string) =>
    this.crm.registrarInteracaoNoCliente(this.data.cliente.id, tipo, descricao);

  protected readonly reclamacoes = toSignal<Reclamacao[] | null>(
    this.crm.reclamacoesDoCliente(this.data.cliente.id).pipe(catchError(() => of([]))),
    { initialValue: null },
  );

  protected readonly contas = toSignal<Conta[] | null>(
    this.data.podeVerFinanceiro
      ? this.crm.contasDoCliente(this.data.cliente.id).pipe(
          map((pagina) => pagina.conteudo),
          catchError(() => of([])),
        )
      : of([]),
    { initialValue: null },
  );

  protected readonly totais = computed(() => {
    let aberto = 0;
    let recebido = 0;
    for (const conta of this.contas() ?? []) {
      if (conta.status === 'PENDENTE') {
        aberto += conta.valorLiquido;
      } else if (conta.status === 'RECEBIDO') {
        recebido += conta.valorLiquido;
      }
    }
    return { aberto, recebido };
  });

  protected editar(): void {
    this.data.editar(this.cliente()).subscribe((salvo) => {
      this.cliente.set(salvo);
      this.alterado = true;
    });
  }
}
