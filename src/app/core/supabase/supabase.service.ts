import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { Observable, defer, from } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notificacao } from '../feedback/notificacao.service';
import { paraCamel, paraSnake } from './caixa';
import { ProblemDetail, traduzirErro, traduzirErroDeFuncao } from './erros';

export interface OpcoesDeExecucao {
  /** Consultas em segundo plano (sino, foto do topo) falham sem aviso na tela. */
  silencioso?: boolean;
  /** Mensagem própria para o 409, como a de edição simultânea de produto. */
  conflito?: string;
  /** Erros de login mostram o motivo em vez de "sessão expirada". */
  autenticacao?: boolean;
}

interface RespostaSupabase<T> {
  data: T;
  error: unknown;
}

/**
 * Único cliente do Supabase do painel. A sessão fica no localStorage e é renovada pelo próprio supabase-js;
 * cada consulta vira um Observable frio que só executa ao ser assinado.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly notificacao = inject(Notificacao);

  readonly cliente: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseChave, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'painel.auth',
    },
  });

  /** Executa uma consulta do supabase-js e devolve os dados em camelCase. */
  executar<T>(consulta: () => PromiseLike<RespostaSupabase<unknown>>, opcoes: OpcoesDeExecucao = {}): Observable<T> {
    return defer(() =>
      from(
        Promise.resolve(consulta()).then(
          ({ data, error }) => {
            if (error) {
              throw this.falha(error, opcoes);
            }
            return paraCamel<T>(data);
          },
          (erro: unknown) => {
            throw this.falha(erro, opcoes);
          },
        ),
      ),
    );
  }

  /** Função do banco (RPC); os argumentos já vão com os nomes `p_...` esperados. */
  rpc<T>(nome: string, argumentos: Record<string, unknown> = {}, opcoes: OpcoesDeExecucao = {}): Observable<T> {
    return this.executar<T>(() => this.cliente.rpc(nome, argumentos), opcoes);
  }

  /** Edge Function autenticada com o token da sessão. */
  funcao<T>(nome: string, corpo: Record<string, unknown>, opcoes: OpcoesDeExecucao = {}): Observable<T> {
    return defer(() =>
      from(
        this.cliente.functions.invoke(nome, { body: corpo }).then(async ({ data, error }) => {
          if (error) {
            throw this.avisar(await traduzirErroDeFuncao(error), opcoes);
          }
          return data as T;
        }),
      ),
    );
  }

  /** Traduz e avisa; útil para validações feitas no navegador antes de gravar. */
  falha(erro: unknown, opcoes: OpcoesDeExecucao = {}): HttpErrorResponse {
    return this.avisar(traduzirErro(erro), opcoes);
  }

  readonly paraSnake = paraSnake;

  private avisar(erro: HttpErrorResponse, opcoes: OpcoesDeExecucao): HttpErrorResponse {
    if (opcoes.silencioso) {
      return erro;
    }
    const problema = erro.error as ProblemDetail | null;
    const detalhe = problema?.detail;
    switch (erro.status) {
      case 0:
        this.notificacao.erro(detalhe ?? 'Não foi possível conectar ao servidor.');
        break;
      case 401:
        if (opcoes.autenticacao) {
          this.notificacao.erro(detalhe ?? 'E-mail ou senha inválidos.');
        } else {
          this.notificacao.aviso('Sua sessão expirou. Entre novamente.');
        }
        break;
      case 403:
        this.notificacao.aviso(detalhe ?? 'Você não tem permissão para esta ação.');
        break;
      case 409:
        if (opcoes.conflito) {
          this.notificacao.aviso(opcoes.conflito);
        } else {
          this.notificacao.erro(detalhe ?? 'A operação conflita com dados existentes.');
        }
        break;
      case 422:
      case 429:
        this.notificacao.aviso(detalhe ?? 'A operação não pôde ser concluída.');
        break;
      case 400:
        this.notificacao.erro(problema?.erros?.length ? 'Verifique os campos destacados no formulário.' : (detalhe ?? 'Requisição inválida.'));
        break;
      default:
        this.notificacao.erro(detalhe ?? 'Ocorreu um erro inesperado. Tente novamente.');
    }
    return erro;
  }
}
