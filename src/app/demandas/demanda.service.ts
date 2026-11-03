import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Demanda, DemandaRequest, FiltroDemandas, StatusDemanda, UsuarioOpcao } from './demanda.model';

@Injectable({ providedIn: 'root' })
export class DemandaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/demandas`;

  listar(filtro: FiltroDemandas = {}): Observable<Demanda[]> {
    let params = new HttpParams();
    if (filtro.responsavel) {
      params = params.set('responsavel', filtro.responsavel);
    }
    if (filtro.abertas) {
      params = params.set('abertas', true);
    }
    return this.http.get<Demanda[]>(this.url, { params });
  }

  criar(dados: DemandaRequest): Observable<Demanda> {
    return this.http.post<Demanda>(this.url, dados);
  }

  atualizar(id: string, dados: DemandaRequest): Observable<Demanda> {
    return this.http.put<Demanda>(`${this.url}/${id}`, dados);
  }

  /** `posicao` é o índice do cartão na coluna de destino, contando todos os cartões dela. */
  mover(id: string, status: StatusDemanda, posicao: number): Observable<Demanda> {
    return this.http.patch<Demanda>(`${this.url}/${id}/status`, { status, posicao });
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  responsaveis(): Observable<UsuarioOpcao[]> {
    return this.http.get<UsuarioOpcao[]>(`${environment.apiUrl}/usuarios/opcoes`);
  }
}
