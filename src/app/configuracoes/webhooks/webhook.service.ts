import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Pagina } from '../../produtos/produto.model';

export interface WebhookSaida {
  id: string;
  nome: string;
  url: string;
  eventos: string[];
  /** Mascarado, exceto logo após criar ou regenerar (`segredoCompleto`). */
  segredo: string;
  segredoCompleto: boolean;
  ativo: boolean;
  criadoEm: string;
}

export interface WebhookEntrada {
  id: string;
  nome: string;
  token: string;
  tokenCompleto: boolean;
  acao: string;
  origemId: string | null;
  ativo: boolean;
  totalRecebidos: number;
  ultimoUsoEm: string | null;
  criadoEm: string;
}

export interface WebhookEntrega {
  id: string;
  webhookId: string;
  evento: string;
  payload: unknown;
  statusHttp: number | null;
  sucesso: boolean;
  tentativas: number;
  erro: string | null;
  duracaoMs: number | null;
  criadoEm: string;
}

export interface Integracao {
  nome: string;
  ativa: boolean;
  detalhe: string;
}

export const DESCRICAO_DOS_EVENTOS: Record<string, string> = {
  'cliente.criado': 'Cliente cadastrado',
  'lead.criado': 'Lead criado',
  'lead.etapa_alterada': 'Lead mudou de etapa',
  'lead.convertido': 'Lead convertido em cliente',
  'reclamacao.aberta': 'Reclamação aberta',
  'reclamacao.status_alterado': 'Reclamação mudou de status',
  'conta.paga': 'Conta paga ou recebida',
  'produto.estoque_baixo': 'Produto com estoque baixo',
  teste: 'Envio de teste',
};

/** Endereço público que outros sistemas chamam para criar leads. */
export const enderecoDeEntrada = (token: string) => `${environment.apiUrl}/webhooks/entrada/${token}`;

@Injectable({ providedIn: 'root' })
export class WebhookService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/configuracoes/webhooks`;

  eventos(): Observable<string[]> {
    return this.http.get<string[]>(`${this.url}/eventos`);
  }

  saidas(): Observable<WebhookSaida[]> {
    return this.http.get<WebhookSaida[]>(`${this.url}/saida`);
  }

  salvarSaida(id: string | null, dados: Record<string, unknown>): Observable<WebhookSaida> {
    return id
      ? this.http.put<WebhookSaida>(`${this.url}/saida/${id}`, dados)
      : this.http.post<WebhookSaida>(`${this.url}/saida`, dados);
  }

  regenerarSegredo(id: string): Observable<WebhookSaida> {
    return this.http.post<WebhookSaida>(`${this.url}/saida/${id}/segredo`, null);
  }

  testar(id: string): Observable<WebhookEntrega> {
    return this.http.post<WebhookEntrega>(`${this.url}/saida/${id}/teste`, null);
  }

  excluirSaida(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/saida/${id}`);
  }

  entregas(filtro: { webhookId?: string | null; sucesso?: boolean | null }, pagina: number, tamanho: number) {
    let params = new HttpParams().set('page', pagina).set('size', tamanho);
    if (filtro.webhookId) {
      params = params.set('webhookId', filtro.webhookId);
    }
    if (filtro.sucesso !== null && filtro.sucesso !== undefined) {
      params = params.set('sucesso', filtro.sucesso);
    }
    return this.http.get<Pagina<WebhookEntrega>>(`${this.url}/entregas`, { params });
  }

  entradas(): Observable<WebhookEntrada[]> {
    return this.http.get<WebhookEntrada[]>(`${this.url}/entrada`);
  }

  salvarEntrada(id: string | null, dados: Record<string, unknown>): Observable<WebhookEntrada> {
    return id
      ? this.http.put<WebhookEntrada>(`${this.url}/entrada/${id}`, dados)
      : this.http.post<WebhookEntrada>(`${this.url}/entrada`, dados);
  }

  regenerarToken(id: string): Observable<WebhookEntrada> {
    return this.http.post<WebhookEntrada>(`${this.url}/entrada/${id}/token`, null);
  }

  excluirEntrada(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/entrada/${id}`);
  }

  integracoes(): Observable<Integracao[]> {
    return this.http.get<Integracao[]>(`${environment.apiUrl}/configuracoes/integracoes`);
  }
}
