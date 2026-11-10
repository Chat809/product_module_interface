import { OpcaoCampo } from '../shared/formulario-cadastro/formulario-cadastro';

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUMERO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function moeda(valor: number | string | null | undefined, codigo = 'BRL'): string | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  const numero = Number(valor);
  return codigo === 'BRL' ? MOEDA.format(numero) : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: codigo }).format(numero);
}

export function numero(valor: number | string | null | undefined): string | null {
  return valor === null || valor === undefined || valor === '' ? null : NUMERO.format(Number(valor));
}

export function percentual(valor: number | string | null | undefined): string | null {
  return valor === null || valor === undefined || valor === '' ? null : `${NUMERO.format(Number(valor))}%`;
}

/** `2026-11-10` ou ISO com hora vira `10/11/2026`. */
export function data(valor: string | null | undefined): string | null {
  if (!valor) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return valor.split('-').reverse().join('/');
  }
  return new Date(valor).toLocaleDateString('pt-BR');
}

export function dataHora(valor: string | null | undefined): string | null {
  return valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
}

export function hojeIso(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

export function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

/** Primeiro dia do mês da data (ou do mês atual). */
export function inicioDoMes(iso = hojeIso()): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Opções de seleção a partir de um mapa `valor → rótulo`. */
export function opcoes(rotulos: Record<string, string>): OpcaoCampo[] {
  return Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));
}

export function rotulo(rotulos: Record<string, string>, valor: string | null | undefined): string | null {
  return valor ? (rotulos[valor] ?? valor) : null;
}

export function linkPublico(token: string): string {
  return `${location.origin}/p/${token}`;
}

/** Copia para a área de transferência; navegadores sem permissão ignoram em silêncio. */
export function copiar(texto: string): Promise<boolean> {
  return navigator.clipboard?.writeText(texto).then(
    () => true,
    () => false,
  ) ?? Promise.resolve(false);
}
