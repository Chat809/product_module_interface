import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pagina } from '../produtos/produto.model';
import { FiltroCadastro, paramsDe } from '../shared/lista-cadastro/lista-cadastro';
import {
  CentroCusto,
  Conta,
  ContaRequest,
  FiltroContas,
  Fornecedor,
  ResumoFinanceiro,
  TIPOS_DE_CONTA,
  TipoConta,
} from './financeiro.model';

@Injectable({ providedIn: 'root' })
export class FinanceiroService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/financeiro`;

  resumo(): Observable<ResumoFinanceiro> {
    return this.http.get<ResumoFinanceiro>(`${this.url}/resumo`);
  }

  listar(tipo: TipoConta, filtro: FiltroContas, pagina: number, tamanho: number): Observable<Pagina<Conta>> {
    let params = new HttpParams().set('page', pagina).set('size', tamanho);
    switch (filtro.situacao) {
      case 'VENCIDAS':
        params = params.set('vencidas', true);
        break;
      case 'QUITADA':
        params = params.set('status', TIPOS_DE_CONTA[tipo].quitado);
        break;
      case 'PENDENTE':
      case 'CANCELADO':
        params = params.set('status', filtro.situacao);
        break;
    }
    const busca = filtro.busca.trim();
    if (busca) {
      params = params.set('busca', busca);
    }
    if (filtro.vencimentoDe) {
      params = params.set('vencimentoDe', filtro.vencimentoDe);
    }
    if (filtro.vencimentoAte) {
      params = params.set('vencimentoAte', filtro.vencimentoAte);
    }
    return this.http.get<Pagina<Conta>>(`${this.url}/${tipo}`, { params });
  }

  criar(tipo: TipoConta, dados: ContaRequest): Observable<Conta> {
    return this.http.post<Conta>(`${this.url}/${tipo}`, dados);
  }

  atualizar(tipo: TipoConta, id: string, dados: ContaRequest): Observable<Conta> {
    return this.http.put<Conta>(`${this.url}/${tipo}/${id}`, dados);
  }

  baixar(tipo: TipoConta, id: string, data: string): Observable<Conta> {
    return this.http.patch<Conta>(`${this.url}/${tipo}/${id}/baixa`, { data });
  }

  cancelar(tipo: TipoConta, id: string): Observable<Conta> {
    return this.http.patch<Conta>(`${this.url}/${tipo}/${id}/cancelamento`, null);
  }

  excluir(tipo: TipoConta, id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${tipo}/${id}`);
  }

  listarFornecedores(filtro: FiltroCadastro, pagina: number, tamanho: number): Observable<Pagina<Fornecedor>> {
    return this.http.get<Pagina<Fornecedor>>(`${this.url}/fornecedores`, { params: paramsDe(filtro, pagina, tamanho) });
  }

  opcoesDeFornecedores(): Observable<Fornecedor[]> {
    return this.http.get<Fornecedor[]>(`${this.url}/fornecedores/opcoes`);
  }

  salvarFornecedor(id: string | null, dados: Record<string, unknown>): Observable<Fornecedor> {
    return id
      ? this.http.put<Fornecedor>(`${this.url}/fornecedores/${id}`, dados)
      : this.http.post<Fornecedor>(`${this.url}/fornecedores`, dados);
  }

  excluirFornecedor(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/fornecedores/${id}`);
  }

  listarCentros(filtro: FiltroCadastro, pagina: number, tamanho: number): Observable<Pagina<CentroCusto>> {
    return this.http.get<Pagina<CentroCusto>>(`${this.url}/centros-custo`, { params: paramsDe(filtro, pagina, tamanho) });
  }

  opcoesDeCentros(): Observable<CentroCusto[]> {
    return this.http.get<CentroCusto[]>(`${this.url}/centros-custo/opcoes`);
  }

  salvarCentro(id: string | null, dados: Record<string, unknown>): Observable<CentroCusto> {
    return id
      ? this.http.put<CentroCusto>(`${this.url}/centros-custo/${id}`, dados)
      : this.http.post<CentroCusto>(`${this.url}/centros-custo`, dados);
  }

  excluirCentro(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/centros-custo/${id}`);
  }
}
