import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ConteudoDoLink {
  tipo: 'FORMULARIO_LEAD' | 'PESQUISA_SATISFACAO' | 'PROPOSTA' | 'VAGA';
  titulo: string;
  configuracao: Record<string, unknown>;
  pesquisa?: { titulo: string; descricao: string | null; tipo: 'NPS' | 'CSAT'; pergunta: string; perguntaComentario: string | null };
  proposta?: {
    numero: string | null;
    titulo: string;
    status: string;
    validade: string | null;
    condicoesPagamento: string | null;
    observacoes: string | null;
    descontoGeral: number;
    valorProdutos: number;
    valorTotal: number;
    itens: { descricao: string; quantidade: number; precoUnitario: number; descontoPercentual: number; valorTotal: number }[];
  };
  vaga?: VagaPublica;
}

export interface VagaPublica {
  id: string;
  titulo: string;
  descricao: string | null;
  requisitos: string | null;
  local: string | null;
  modalidade: string;
  tipoContrato: string;
  departamento?: string | null;
}

export class ErroPublico extends Error {}

const FUNCAO = `${environment.supabaseUrl}/functions/v1/formulario-publico`;
const CABECALHOS = { apikey: environment.supabaseChave, 'Content-Type': 'application/json' };

/**
 * Chamadas das páginas abertas (sem login). Usa `fetch` com a chave publicável, sem a sessão de quem
 * eventualmente esteja logado no navegador: a página se comporta igual para todos.
 */
@Injectable({ providedIn: 'root' })
export class PublicoService {
  async conteudo(token: string): Promise<ConteudoDoLink> {
    return this.pedir(`${FUNCAO}?token=${encodeURIComponent(token)}`, { method: 'GET', headers: CABECALHOS });
  }

  async responder(token: string, dados: Record<string, unknown>, curriculo?: string | null, site = ''): Promise<unknown> {
    return this.enviar({ token, dados, site, ...(curriculo ? { curriculo: { base64: curriculo } } : {}) });
  }

  async candidatar(vagaId: string, dados: Record<string, unknown>, curriculo?: string | null, site = ''): Promise<unknown> {
    return this.enviar({ vagaId, dados, site, ...(curriculo ? { curriculo: { base64: curriculo } } : {}) });
  }

  async vagasAbertas(): Promise<VagaPublica[]> {
    const campos = 'id,titulo,descricao,requisitos,local,modalidade,tipo_contrato,departamento';
    const linhas = await this.pedir<Record<string, unknown>[]>(
      `${environment.supabaseUrl}/rest/v1/vagas_emprego?select=${campos}&publica=eq.true&status=eq.ABERTA&order=titulo`,
      { method: 'GET', headers: CABECALHOS },
    );
    return linhas.map((l) => ({ ...l, tipoContrato: l['tipo_contrato'] }) as unknown as VagaPublica);
  }

  private enviar(corpo: Record<string, unknown>): Promise<unknown> {
    return this.pedir(FUNCAO, { method: 'POST', headers: CABECALHOS, body: JSON.stringify(corpo) });
  }

  private async pedir<T>(url: string, init: RequestInit): Promise<T> {
    let resposta: Response;
    try {
      resposta = await fetch(url, init);
    } catch {
      throw new ErroPublico('Não foi possível conectar. Verifique sua internet e tente novamente.');
    }
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new ErroPublico((corpo as { mensagem?: string } | null)?.mensagem ?? 'Não foi possível concluir. Tente novamente.');
    }
    return corpo as T;
  }
}

/** Lê o PDF como base64 (sem o prefixo `data:`). */
export function lerComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] ?? '');
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}
