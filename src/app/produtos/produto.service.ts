import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Movimentacao,
  MovimentacaoRequest,
  Pagina,
  Produto,
  ProdutoRequest,
  ResumoEstoque,
} from './produto.model';

/** Maior página aceita pela API: o painel carrega o catálogo inteiro de uma vez e filtra no navegador. */
export const TAMANHO_CATALOGO = 500;

@Injectable({ providedIn: 'root' })
export class ProdutoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/produtos`;

  listarCatalogo(): Observable<Produto[]> {
    return this.http
      .get<Pagina<Produto>>(this.url, { params: { size: TAMANHO_CATALOGO, sort: 'nome,asc' } })
      .pipe(map((pagina) => pagina.conteudo));
  }

  buscarPorId(id: string): Observable<Produto> {
    return this.http.get<Produto>(`${this.url}/${id}`);
  }

  criar(produto: ProdutoRequest): Observable<Produto> {
    return this.http.post<Produto>(this.url, produto);
  }

  /** A versão vai também no If-Match, para a API recusar com 409 se o produto mudou desde a leitura. */
  atualizar(id: string, produto: ProdutoRequest): Observable<Produto> {
    const headers: Record<string, string> =
      produto.versao == null ? {} : { 'If-Match': `"${produto.versao}"` };
    return this.http.put<Produto>(`${this.url}/${id}`, produto, { headers });
  }

  remover(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  movimentar(id: string, movimentacao: MovimentacaoRequest): Observable<Movimentacao> {
    return this.http.post<Movimentacao>(`${this.url}/${id}/movimentacoes`, movimentacao);
  }

  historico(id: string, tamanho = 5): Observable<Pagina<Movimentacao>> {
    return this.http.get<Pagina<Movimentacao>>(`${this.url}/${id}/movimentacoes`, {
      params: { page: 0, size: tamanho },
    });
  }

  categorias(): Observable<string[]> {
    return this.http.get<string[]>(`${this.url}/categorias`);
  }

  resumo(): Observable<ResumoEstoque> {
    return this.http.get<ResumoEstoque>(`${this.url}/resumo`);
  }
}
