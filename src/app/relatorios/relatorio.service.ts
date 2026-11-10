import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TipoRelatorio = 'financeiro' | 'comercial' | 'estoque' | 'atendimento';
export type FormatoRelatorio = 'moeda' | 'numero' | 'percentual' | 'dias' | 'texto';

export interface Relatorio {
  indicadores: { rotulo: string; valor: number; formato: FormatoRelatorio }[];
  graficos: { titulo: string; formato: FormatoRelatorio; itens: { rotulo: string; valor: number }[] }[];
  tabelas: {
    titulo: string;
    colunas: { chave: string; rotulo: string; formato: FormatoRelatorio }[];
    linhas: Record<string, unknown>[];
  }[];
}

export interface Periodo {
  inicio: string;
  fim: string;
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatar(valor: unknown, formato: FormatoRelatorio): string {
  if (valor === null || valor === undefined || valor === '') {
    return '—';
  }
  if (formato === 'texto' || typeof valor !== 'number') {
    return String(valor);
  }
  switch (formato) {
    case 'moeda':
      return moeda.format(valor);
    case 'percentual':
      return `${numero.format(valor)}%`;
    case 'dias':
      return `${numero.format(valor)} ${valor === 1 ? 'dia' : 'dias'}`;
    default:
      return numero.format(valor);
  }
}

@Injectable({ providedIn: 'root' })
export class RelatorioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/relatorios`;

  gerar(tipo: TipoRelatorio, periodo: Periodo | null): Observable<Relatorio> {
    return this.http.get<Relatorio>(`${this.url}/${tipo}`, { params: this.params(periodo) });
  }

  csv(tipo: TipoRelatorio, periodo: Periodo | null): Observable<Blob> {
    return this.http.get(`${this.url}/${tipo}/csv`, { params: this.params(periodo), responseType: 'blob' });
  }

  private params(periodo: Periodo | null): HttpParams {
    return periodo ? new HttpParams().set('inicio', periodo.inicio).set('fim', periodo.fim) : new HttpParams();
  }
}
