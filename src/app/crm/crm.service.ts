import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UsuarioOpcao } from '../demandas/demanda.model';
import { Conta } from '../financeiro/financeiro.model';
import { Pagina } from '../produtos/produto.model';
import { FiltroCadastro, paramsDe } from '../shared/lista-cadastro/lista-cadastro';
import {
  Cliente,
  CrmEtapa,
  CrmOrigem,
  Interacao,
  Lead,
  Reclamacao,
  ReclamacaoEvento,
  StatusReclamacao,
  TipoInteracao,
} from './crm.model';

export interface FiltroLeads {
  etapaId?: string | null;
  origemId?: string | null;
  responsavelId?: string | null;
}

export interface FiltroReclamacoes {
  status?: StatusReclamacao | null;
  responsavelId?: string | null;
}

/** Monta os parâmetros ignorando os filtros vazios. */
function comFiltros(params: HttpParams, filtros: object): HttpParams {
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) {
      params = params.set(chave, String(valor));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class CrmService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/crm`;

  responsaveis(): Observable<UsuarioOpcao[]> {
    return this.http.get<UsuarioOpcao[]>(`${environment.apiUrl}/usuarios/opcoes`);
  }

  listarClientes(filtro: FiltroCadastro, pagina: number, tamanho: number): Observable<Pagina<Cliente>> {
    return this.http.get<Pagina<Cliente>>(`${this.url}/clientes`, { params: paramsDe(filtro, pagina, tamanho) });
  }

  opcoesDeClientes(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(`${this.url}/clientes/opcoes`);
  }

  buscarCliente(id: string): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.url}/clientes/${id}`);
  }

  salvarCliente(id: string | null, dados: Record<string, unknown>): Observable<Cliente> {
    return id
      ? this.http.put<Cliente>(`${this.url}/clientes/${id}`, dados)
      : this.http.post<Cliente>(`${this.url}/clientes`, dados);
  }

  excluirCliente(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/clientes/${id}`);
  }

  interacoesDoCliente(id: string): Observable<Interacao[]> {
    return this.http.get<Interacao[]>(`${this.url}/clientes/${id}/interacoes`);
  }

  registrarInteracaoNoCliente(id: string, tipo: TipoInteracao, descricao: string): Observable<Interacao> {
    return this.http.post<Interacao>(`${this.url}/clientes/${id}/interacoes`, { tipo, descricao });
  }

  reclamacoesDoCliente(id: string): Observable<Reclamacao[]> {
    return this.http.get<Reclamacao[]>(`${this.url}/clientes/${id}/reclamacoes`);
  }

  /** Contas a receber ligadas ao cliente; exige a subaba Contas a receber. */
  contasDoCliente(id: string): Observable<Pagina<Conta>> {
    const params = new HttpParams().set('vinculoId', id).set('size', 50);
    return this.http.get<Pagina<Conta>>(`${environment.apiUrl}/financeiro/contas-receber`, { params });
  }

  listarLeads(filtro: FiltroCadastro, extras: FiltroLeads, pagina: number, tamanho: number): Observable<Pagina<Lead>> {
    return this.http.get<Pagina<Lead>>(`${this.url}/leads`, {
      params: comFiltros(paramsDe(filtro, pagina, tamanho), extras),
    });
  }

  funil(busca: string, responsavelId: string | null): Observable<Lead[]> {
    return this.http.get<Lead[]>(`${this.url}/leads/funil`, {
      params: comFiltros(new HttpParams(), { busca: busca.trim(), responsavelId }),
    });
  }

  salvarLead(id: string | null, dados: Record<string, unknown>): Observable<Lead> {
    return id ? this.http.put<Lead>(`${this.url}/leads/${id}`, dados) : this.http.post<Lead>(`${this.url}/leads`, dados);
  }

  moverLead(id: string, etapaId: string, ordem: number | null, motivoPerda: string | null = null): Observable<Lead> {
    return this.http.patch<Lead>(`${this.url}/leads/${id}/etapa`, { etapaId, ordem, motivoPerda });
  }

  converterLead(id: string): Observable<Lead> {
    return this.http.post<Lead>(`${this.url}/leads/${id}/converter`, null);
  }

  excluirLead(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/leads/${id}`);
  }

  interacoesDoLead(id: string): Observable<Interacao[]> {
    return this.http.get<Interacao[]>(`${this.url}/leads/${id}/interacoes`);
  }

  registrarInteracaoNoLead(id: string, tipo: TipoInteracao, descricao: string): Observable<Interacao> {
    return this.http.post<Interacao>(`${this.url}/leads/${id}/interacoes`, { tipo, descricao });
  }

  listarReclamacoes(
    filtro: FiltroCadastro,
    extras: FiltroReclamacoes,
    pagina: number,
    tamanho: number,
  ): Observable<Pagina<Reclamacao>> {
    return this.http.get<Pagina<Reclamacao>>(`${this.url}/reclamacoes`, {
      params: comFiltros(paramsDe(filtro, pagina, tamanho), extras),
    });
  }

  quadroDeReclamacoes(busca: string, responsavelId: string | null): Observable<Reclamacao[]> {
    return this.http.get<Reclamacao[]>(`${this.url}/reclamacoes/quadro`, {
      params: comFiltros(new HttpParams(), { busca: busca.trim(), responsavelId }),
    });
  }

  salvarReclamacao(id: string | null, dados: Record<string, unknown>): Observable<Reclamacao> {
    return id
      ? this.http.put<Reclamacao>(`${this.url}/reclamacoes/${id}`, dados)
      : this.http.post<Reclamacao>(`${this.url}/reclamacoes`, dados);
  }

  alterarStatus(
    id: string,
    status: StatusReclamacao,
    solucao: string | null = null,
    comentario: string | null = null,
  ): Observable<Reclamacao> {
    return this.http.patch<Reclamacao>(`${this.url}/reclamacoes/${id}/status`, { status, solucao, comentario });
  }

  historico(id: string): Observable<ReclamacaoEvento[]> {
    return this.http.get<ReclamacaoEvento[]>(`${this.url}/reclamacoes/${id}/historico`);
  }

  comentar(id: string, comentario: string): Observable<ReclamacaoEvento> {
    return this.http.post<ReclamacaoEvento>(`${this.url}/reclamacoes/${id}/comentarios`, { comentario });
  }

  etapas(): Observable<CrmEtapa[]> {
    return this.http.get<CrmEtapa[]>(`${this.url}/parametros/etapas`);
  }

  salvarEtapa(id: string | null, dados: Record<string, unknown>): Observable<CrmEtapa> {
    return id
      ? this.http.put<CrmEtapa>(`${this.url}/parametros/etapas/${id}`, dados)
      : this.http.post<CrmEtapa>(`${this.url}/parametros/etapas`, dados);
  }

  excluirEtapa(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/parametros/etapas/${id}`);
  }

  origens(): Observable<CrmOrigem[]> {
    return this.http.get<CrmOrigem[]>(`${this.url}/parametros/origens`);
  }

  salvarOrigem(id: string | null, dados: Record<string, unknown>): Observable<CrmOrigem> {
    return id
      ? this.http.put<CrmOrigem>(`${this.url}/parametros/origens/${id}`, dados)
      : this.http.post<CrmOrigem>(`${this.url}/parametros/origens`, dados);
  }

  excluirOrigem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/parametros/origens/${id}`);
  }
}
