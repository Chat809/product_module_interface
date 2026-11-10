import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { RepositorioSupabase } from '../core/supabase/repositorio';
import { erroHttp } from '../core/supabase/erros';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Pagina } from '../produtos/produto.model';

export type TipoNotificacao =
  | 'LEAD_ATRIBUIDO'
  | 'RECLAMACAO_ABERTA'
  | 'RECLAMACAO_ATRIBUIDA'
  | 'DEMANDA_ATRIBUIDA'
  | 'CONTA_VENCENDO'
  | 'CONTA_VENCIDA'
  | 'JORNADA_ETAPA'
  | 'COMPROMISSO_PROXIMO'
  | 'CANDIDATURA_RECEBIDA';

export interface Notificacao {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string | null;
  /** Rota do painel, como `/crm/leads`. */
  link: string | null;
  lidaEm: string | null;
  criadoEm: string;
}

export interface PreferenciaNotificacao {
  tipo: TipoNotificacao;
  descricao: string;
  noApp: boolean;
  porEmail: boolean;
}

export interface PreferenciasNotificacao {
  emailDisponivel: boolean;
  preferencias: PreferenciaNotificacao[];
}

export const ICONES_DE_NOTIFICACAO: Record<TipoNotificacao, string> = {
  LEAD_ATRIBUIDO: 'person_add',
  RECLAMACAO_ABERTA: 'report_problem',
  RECLAMACAO_ATRIBUIDA: 'assignment_ind',
  DEMANDA_ATRIBUIDA: 'view_week',
  CONTA_VENCENDO: 'schedule',
  CONTA_VENCIDA: 'event_busy',
  JORNADA_ETAPA: 'route',
  COMPROMISSO_PROXIMO: 'event',
  CANDIDATURA_RECEBIDA: 'person_search',
};

export const DESCRICOES_DE_NOTIFICACAO: Record<TipoNotificacao, string> = {
  LEAD_ATRIBUIDO: 'Um lead foi atribuído a mim',
  RECLAMACAO_ABERTA: 'Nova reclamação sem responsável',
  RECLAMACAO_ATRIBUIDA: 'Uma reclamação foi atribuída a mim',
  DEMANDA_ATRIBUIDA: 'Fui incluído como responsável em uma demanda',
  CONTA_VENCENDO: 'Conta vence nos próximos 3 dias',
  CONTA_VENCIDA: 'Conta venceu sem baixa',
  JORNADA_ETAPA: 'Uma etapa de jornada de relacionamento ficou pronta',
  COMPROMISSO_PROXIMO: 'Lembrete de compromisso da agenda',
  CANDIDATURA_RECEBIDA: 'Nova candidatura em uma vaga',
};

/** O envio por e-mail depende de um provedor configurado no projeto; até lá, só no painel. */
const EMAIL_DISPONIVEL = false;

@Injectable({ providedIn: 'root' })
export class NotificacaoService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly notificacoes = new RepositorioSupabase<Notificacao>(this.supabase, {
    tabela: 'notificacoes',
    ordem: [{ coluna: 'criado_em', crescente: false }, { coluna: 'id' }],
  });

  /** As políticas do banco só mostram as notificações da própria pessoa. */
  listar(pagina = 0, tamanho = 10, naoLidas = false): Observable<Pagina<Notificacao>> {
    return this.notificacoes.listar({}, pagina, tamanho, {}, naoLidas ? (c) => c.is('lida_em', null) : undefined);
  }

  /** Consultado em segundo plano pelo sino: falhas não geram aviso na tela. */
  naoLidas(): Observable<number> {
    return this.supabase
      .executar<number>(
        () =>
          this.supabase.cliente
            .from('notificacoes')
            .select('id', { count: 'exact', head: true })
            .is('lida_em', null)
            .then((r) => ({ data: r.count ?? 0, error: r.error })),
        { silencioso: true },
      );
  }

  marcarLida(id: string): Observable<void> {
    return this.supabase
      .executar<{ id: string }[]>(() =>
        this.supabase.cliente.from('notificacoes').update({ lida_em: new Date().toISOString() }).eq('id', id).select('id'),
      )
      .pipe(
        map((linhas) => {
          if (!linhas.length) {
            throw this.supabase.falha(erroHttp(404, 'Notificação não encontrada.'));
          }
        }),
      );
  }

  marcarTodasLidas(): Observable<void> {
    return this.supabase
      .executar<unknown>(() =>
        this.supabase.cliente.from('notificacoes').update({ lida_em: new Date().toISOString() }).is('lida_em', null),
      )
      .pipe(map(() => undefined));
  }

  /** Todos os tipos, com o que a pessoa gravou ou o padrão (no painel sim, por e-mail não). */
  preferencias(): Observable<PreferenciasNotificacao> {
    return this.supabase
      .executar<{ tipo: TipoNotificacao; noApp: boolean; porEmail: boolean }[]>(() =>
        this.supabase.cliente.from('preferencias_notificacao').select('tipo, no_app, por_email'),
      )
      .pipe(
        map((gravadas) => ({
          emailDisponivel: EMAIL_DISPONIVEL,
          preferencias: (Object.keys(DESCRICOES_DE_NOTIFICACAO) as TipoNotificacao[]).map((tipo) => {
            const gravada = gravadas.find((g) => g.tipo === tipo);
            return {
              tipo,
              descricao: DESCRICOES_DE_NOTIFICACAO[tipo],
              noApp: gravada?.noApp ?? true,
              porEmail: gravada?.porEmail ?? false,
            };
          }),
        })),
      );
  }

  salvarPreferencias(preferencias: PreferenciaNotificacao[]): Observable<PreferenciasNotificacao> {
    const usuarioId = this.auth.usuario()?.id;
    const linhas = preferencias.map((p) => ({ usuario_id: usuarioId, tipo: p.tipo, no_app: p.noApp, por_email: p.porEmail }));
    return this.supabase
      .executar<unknown>(() =>
        this.supabase.cliente.from('preferencias_notificacao').upsert(linhas, { onConflict: 'usuario_id,tipo' }),
      )
      .pipe(switchMap(() => this.preferencias()));
  }
}
