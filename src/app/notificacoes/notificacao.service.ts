import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SEM_AVISO_DE_ERRO } from '../core/http/error.interceptor';
import { Pagina } from '../produtos/produto.model';

export type TipoNotificacao =
  | 'LEAD_ATRIBUIDO'
  | 'RECLAMACAO_ABERTA'
  | 'RECLAMACAO_ATRIBUIDA'
  | 'DEMANDA_ATRIBUIDA'
  | 'CONTA_VENCENDO'
  | 'CONTA_VENCIDA';

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
};

@Injectable({ providedIn: 'root' })
export class NotificacaoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/notificacoes`;

  listar(pagina = 0, tamanho = 10, naoLidas = false): Observable<Pagina<Notificacao>> {
    const params = new HttpParams().set('page', pagina).set('size', tamanho).set('naoLidas', naoLidas);
    return this.http.get<Pagina<Notificacao>>(this.url, { params });
  }

  /** Consultado em segundo plano pelo sino: falhas não geram aviso na tela. */
  naoLidas(): Observable<number> {
    return this.http
      .get<{ total: number }>(`${this.url}/nao-lidas`, { context: new HttpContext().set(SEM_AVISO_DE_ERRO, true) })
      .pipe(map((r) => r.total));
  }

  marcarLida(id: string): Observable<void> {
    return this.http.patch<void>(`${this.url}/${id}/lida`, null);
  }

  marcarTodasLidas(): Observable<void> {
    return this.http.patch<unknown>(`${this.url}/lidas`, null).pipe(map(() => undefined));
  }

  preferencias(): Observable<PreferenciasNotificacao> {
    return this.http.get<PreferenciasNotificacao>(`${this.url}/preferencias`);
  }

  salvarPreferencias(preferencias: PreferenciaNotificacao[]): Observable<PreferenciasNotificacao> {
    return this.http.put<PreferenciasNotificacao>(`${this.url}/preferencias`, { preferencias });
  }
}
