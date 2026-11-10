import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { UsuarioOpcao } from '../../demandas/demanda.model';
import { Skeleton } from '../skeleton/skeleton';

export type AcaoAuditoria = 'CRIACAO' | 'ALTERACAO' | 'EXCLUSAO';

export interface RegistroAuditoria {
  id: number;
  tabela: string;
  registroId: string;
  acao: AcaoAuditoria;
  /** Na alteração, `{ coluna: { de, para } }`; na exclusão, a linha apagada. Chaves no nome do banco. */
  alteracoes: Record<string, unknown> | null;
  usuarioId: string | null;
  criadoEm: string;
}

export interface Mudanca {
  campo: string;
  de: string;
  para: string;
}

export const ACOES_DE_AUDITORIA: Record<AcaoAuditoria, { rotulo: string; icone: string }> = {
  CRIACAO: { rotulo: 'Criado', icone: 'add_circle' },
  ALTERACAO: { rotulo: 'Alterado', icone: 'edit' },
  EXCLUSAO: { rotulo: 'Excluído', icone: 'delete' },
};

/** `data_vencimento` vira "Data vencimento"; não há dicionário, para servir a qualquer tabela. */
export function rotuloDaColuna(coluna: string): string {
  const texto = coluna.replace(/_id$/, '').replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function valorLegivel(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') {
    return '—';
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sim' : 'Não';
  }
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return valor.split('-').reverse().join('/');
  }
  if (Array.isArray(valor)) {
    return valor.length ? valor.map(valorLegivel).join(', ') : '—';
  }
  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }
  return String(valor);
}

export function mudancasDe(registro: RegistroAuditoria): Mudanca[] {
  if (registro.acao !== 'ALTERACAO' || !registro.alteracoes) {
    return [];
  }
  return Object.entries(registro.alteracoes).map(([coluna, par]) => {
    const { de, para } = (par ?? {}) as { de?: unknown; para?: unknown };
    return { campo: rotuloDaColuna(coluna), de: valorLegivel(de), para: valorLegivel(para) };
  });
}

/** Quem criou e alterou o registro, campo a campo. Só aparece para quem pode ver o registro (regra no banco). */
@Component({
  selector: 'app-historico-auditoria',
  imports: [DatePipe, MatIconModule, Skeleton],
  template: `
    @if (registros() === null) {
      <app-skeleton [linhas]="3" />
    } @else if (registros()!.length === 0) {
      <p class="vazio">Nenhuma alteração registrada.</p>
    } @else {
      <ol class="linha-do-tempo">
        @for (registro of registros(); track registro.id) {
          <li>
            <mat-icon class="icone">{{ acoes[registro.acao].icone }}</mat-icon>
            <div>
              <p class="cabeca">
                <strong>{{ acoes[registro.acao].rotulo }}</strong>
                · {{ registro.criadoEm | date: 'dd/MM/yyyy HH:mm' }}
                · {{ nomeDe(registro.usuarioId) }}
              </p>
              @for (mudanca of mudancas(registro); track mudanca.campo) {
                <p class="mudanca">
                  <span class="campo">{{ mudanca.campo }}:</span>
                  <span class="de">{{ mudanca.de }}</span>
                  <mat-icon class="seta">arrow_forward</mat-icon>
                  <span>{{ mudanca.para }}</span>
                </p>
              }
            </div>
          </li>
        }
      </ol>
    }
  `,
  styles: `
    .linha-do-tempo {
      margin: 16px 0 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }

    .icone {
      color: var(--mat-sys-primary);
    }

    .cabeca {
      margin: 0;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .mudanca {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      margin: 4px 0 0;
      overflow-wrap: anywhere;
    }

    .campo {
      font-weight: 500;
    }

    .de {
      color: var(--mat-sys-on-surface-variant);
      text-decoration: line-through;
    }

    .seta {
      width: 16px;
      height: 16px;
      font-size: 16px;
      color: var(--mat-sys-on-surface-variant);
    }

    .vazio {
      margin-top: 16px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class HistoricoAuditoria implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tabela = input.required<string>();
  readonly registroId = input.required<string>();

  protected readonly registros = signal<RegistroAuditoria[] | null>(null);
  private readonly pessoas = signal(new Map<string, string>());
  protected readonly acoes = ACOES_DE_AUDITORIA;
  protected readonly mudancas = mudancasDe;

  ngOnInit(): void {
    forkJoin({
      registros: this.supabase.executar<RegistroAuditoria[]>(
        () =>
          this.supabase.cliente
            .from('trilha_auditoria')
            .select('*')
            .eq('tabela', this.tabela())
            .eq('registro_id', this.registroId())
            .order('criado_em', { ascending: false })
            .limit(200),
        { silencioso: true },
      ),
      pessoas: this.supabase.rpc<UsuarioOpcao[]>('opcoes_usuarios', {}, { silencioso: true }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ registros, pessoas }) => {
          this.pessoas.set(new Map(pessoas.map((p) => [p.id, p.nome])));
          this.registros.set(registros);
        },
        error: () => this.registros.set([]),
      });
  }

  protected nomeDe(usuarioId: string | null): string {
    return usuarioId ? (this.pessoas().get(usuarioId) ?? 'Usuário removido') : 'Sistema';
  }
}
