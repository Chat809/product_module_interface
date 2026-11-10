import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RepositorioSupabase } from '../../core/supabase/repositorio';
import { erroHttp } from '../../core/supabase/erros';
import { SupabaseService } from '../../core/supabase/supabase.service';
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
  'conta.paga': 'Conta paga',
  'conta.recebida': 'Conta recebida',
  'produto.estoque_baixo': 'Produto com estoque baixo',
  'proposta.aprovada': 'Proposta aprovada',
  'pedido.faturado': 'Pedido faturado',
  'candidatura.recebida': 'Candidatura recebida',
  'satisfacao.respondida': 'Pesquisa de satisfação respondida',
  'teste.ping': 'Envio de teste',
  teste: 'Envio de teste',
};

/** Endereço público (Edge Function) que outros sistemas chamam para criar leads. */
export const enderecoDeEntrada = (token: string) => `${environment.supabaseUrl}/functions/v1/webhooks-entrada/${token}`;

/** Segredos e tokens com 48 bytes aleatórios em hexadecimal (96 caracteres). */
function gerarSegredo(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(48)), (b) => b.toString(16).padStart(2, '0')).join('');
}

function mascarar(valor: string): string {
  return valor.length > 8 ? `${valor.slice(0, 4)}••••••••${valor.slice(-4)}` : '••••••••';
}

@Injectable({ providedIn: 'root' })
export class WebhookService {
  private readonly supabase = inject(SupabaseService);
  private readonly saidasRepo = new RepositorioSupabase<WebhookSaida>(this.supabase, {
    tabela: 'webhooks_saida',
    ordem: [{ coluna: 'criado_em' }],
  });
  private readonly entradasRepo = new RepositorioSupabase<WebhookEntrada>(this.supabase, {
    tabela: 'webhooks_entrada',
    ordem: [{ coluna: 'criado_em' }],
  });
  private readonly entregasRepo = new RepositorioSupabase<WebhookEntrega>(this.supabase, {
    tabela: 'webhook_entregas',
    ordem: [{ coluna: 'criado_em', crescente: false }, { coluna: 'id' }],
  });

  private saida(webhook: WebhookSaida, completo = false): WebhookSaida {
    return { ...webhook, segredo: completo ? webhook.segredo : mascarar(webhook.segredo), segredoCompleto: completo };
  }

  private entrada(webhook: WebhookEntrada, completo = false): WebhookEntrada {
    return { ...webhook, token: completo ? webhook.token : mascarar(webhook.token), tokenCompleto: completo };
  }

  eventos(): Observable<string[]> {
    return this.supabase.rpc<string[]>('eventos_webhook');
  }

  saidas(): Observable<WebhookSaida[]> {
    return this.saidasRepo.todos().pipe(map((lista) => lista.map((w) => this.saida(w))));
  }

  /** O segredo só aparece inteiro logo após a criação. */
  salvarSaida(id: string | null, dados: Record<string, unknown>): Observable<WebhookSaida> {
    return id
      ? this.saidasRepo.atualizar(id, dados).pipe(map((w) => this.saida(w)))
      : this.saidasRepo.criar({ ...dados, segredo: gerarSegredo() }).pipe(map((w) => this.saida(w, true)));
  }

  regenerarSegredo(id: string): Observable<WebhookSaida> {
    return this.saidasRepo.atualizar(id, { segredo: gerarSegredo() }).pipe(map((w) => this.saida(w, true)));
  }

  /** A Edge Function `webhooks-saida` envia o teste e grava a entrega, que é lida em seguida. */
  testar(id: string): Observable<WebhookEntrega> {
    return this.supabase.funcao<{ sucesso: boolean }>('webhooks-saida', { acao: 'testar', webhookId: id }).pipe(
      switchMap(() => this.entregasRepo.listar({}, 0, 1, { webhookId: id })),
      map((pagina) => {
        if (!pagina.conteudo.length) {
          throw this.supabase.falha(erroHttp(404, 'A entrega de teste não foi registrada.'));
        }
        return pagina.conteudo[0];
      }),
    );
  }

  excluirSaida(id: string): Observable<void> {
    return this.saidasRepo.excluir(id);
  }

  entregas(
    filtro: { webhookId?: string | null; sucesso?: boolean | null },
    pagina: number,
    tamanho: number,
  ): Observable<Pagina<WebhookEntrega>> {
    return this.entregasRepo.listar({}, pagina, tamanho, { webhookId: filtro.webhookId, sucesso: filtro.sucesso });
  }

  entradas(): Observable<WebhookEntrada[]> {
    return this.entradasRepo.todos().pipe(map((lista) => lista.map((w) => this.entrada(w))));
  }

  salvarEntrada(id: string | null, dados: Record<string, unknown>): Observable<WebhookEntrada> {
    return id
      ? this.entradasRepo.atualizar(id, dados).pipe(map((w) => this.entrada(w)))
      : this.entradasRepo
          .criar({ acao: 'CRIAR_LEAD', ...dados, token: gerarSegredo() })
          .pipe(map((w) => this.entrada(w, true)));
  }

  regenerarToken(id: string): Observable<WebhookEntrada> {
    return this.entradasRepo.atualizar(id, { token: gerarSegredo() }).pipe(map((w) => this.entrada(w, true)));
  }

  excluirEntrada(id: string): Observable<void> {
    return this.entradasRepo.excluir(id);
  }

  integracoes(): Observable<Integracao[]> {
    return this.supabase.funcao<Integracao[]>('status-integracoes', {});
  }
}
