import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SupabaseService } from '../core/supabase/supabase.service';

export type TipoRelatorio = 'financeiro' | 'comercial' | 'estoque' | 'atendimento' | 'dre' | 'satisfacao';
export type FormatoRelatorio = 'moeda' | 'numero' | 'percentual' | 'dias' | 'texto' | 'data';

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
  if (formato === 'data' && typeof valor === 'string') {
    const [ano, mes, dia] = valor.slice(0, 10).split('-');
    return dia ? `${dia}/${mes}/${ano}` : valor;
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

/** Campo de CSV com `;` (padrão do Excel em português), entre aspas quando precisa. */
function campoCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : typeof valor === 'number' ? String(valor).replace('.', ',') : String(valor);
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Indicadores e tabelas do relatório num CSV só, com BOM para o Excel reconhecer os acentos. */
export function relatorioEmCsv(relatorio: Relatorio): Blob {
  const linhas: string[] = [];
  if (relatorio.indicadores.length) {
    linhas.push('Indicador;Valor');
    relatorio.indicadores.forEach((i) => linhas.push(`${campoCsv(i.rotulo)};${campoCsv(i.valor)}`));
  }
  for (const tabela of relatorio.tabelas) {
    linhas.push('', campoCsv(tabela.titulo), tabela.colunas.map((c) => campoCsv(c.rotulo)).join(';'));
    tabela.linhas.forEach((linha) => linhas.push(tabela.colunas.map((c) => campoCsv(linha[c.chave])).join(';')));
  }
  return new Blob(['\uFEFF' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

@Injectable({ providedIn: 'root' })
export class RelatorioService {
  private readonly supabase = inject(SupabaseService);

  /** A função `relatorio` confere a subaba `relatorios/<tipo>` antes de montar os dados. */
  gerar(tipo: TipoRelatorio, periodo: Periodo | null): Observable<Relatorio> {
    return this.supabase.rpc<Relatorio>('relatorio', {
      p_tipo: tipo,
      p_inicio: periodo?.inicio ?? null,
      p_fim: periodo?.fim ?? null,
    });
  }

  csv(tipo: TipoRelatorio, periodo: Periodo | null): Observable<Blob> {
    return this.gerar(tipo, periodo).pipe(map(relatorioEmCsv));
  }
}
