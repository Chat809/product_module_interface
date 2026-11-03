import { Produto } from './produto.model';

export type SituacaoEstoque = 'disponivel' | 'baixo' | 'esgotado';
export type FiltroSituacao = SituacaoEstoque | 'todos';
export type ColunaOrdenavel = 'nome' | 'preco' | 'quantidadeEmEstoque' | 'atualizadoEm';

export interface Ordenacao {
  coluna: ColunaOrdenavel;
  direcao: 'asc' | 'desc';
}

export interface TrechoDestacado {
  texto: string;
  destaque: boolean;
}

/** Produto acompanhado do texto pesquisável já normalizado, calculado uma vez por carga. */
export interface ProdutoIndexado {
  produto: Produto;
  chave: string;
}

/**
 * Remove acentos e passa para minúsculas caractere a caractere, preservando o tamanho
 * do texto para que as posições encontradas sirvam para destacar o original.
 */
export function normalizar(texto: string): string {
  let resultado = '';
  for (const caractere of texto) {
    const base = caractere.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    resultado += (base || caractere).charAt(0).padEnd(caractere.length, ' ');
  }
  return resultado;
}

export function termosDaBusca(busca: string): string[] {
  return normalizar(busca).split(/\s+/).filter(Boolean);
}

export function indexar(produtos: Produto[]): ProdutoIndexado[] {
  return produtos.map((produto) => ({
    produto,
    chave: normalizar(`${produto.nome} ${produto.descricao ?? ''}`),
  }));
}

export function situacaoDoEstoque(quantidade: number, limiteBaixo: number): SituacaoEstoque {
  if (quantidade === 0) {
    return 'esgotado';
  }
  return quantidade <= limiteBaixo ? 'baixo' : 'disponivel';
}

/** Mantém os produtos que contêm todos os termos (em qualquer ordem) e estão na situação pedida. */
export function filtrar(
  indice: ProdutoIndexado[],
  termos: string[],
  situacao: FiltroSituacao,
  limiteBaixo: number,
): Produto[] {
  return indice
    .filter(
      ({ produto, chave }) =>
        termos.every((termo) => chave.includes(termo)) &&
        (situacao === 'todos' ||
          situacaoDoEstoque(produto.quantidadeEmEstoque, limiteBaixo) === situacao),
    )
    .map(({ produto }) => produto);
}

export function ordenar(produtos: Produto[], { coluna, direcao }: Ordenacao): Produto[] {
  const fator = direcao === 'asc' ? 1 : -1;
  return [...produtos].sort((a, b) => {
    const [x, y] = [a[coluna], b[coluna]];
    const comparacao =
      typeof x === 'number'
        ? x - (y as number)
        : (x as string).localeCompare(y as string, 'pt-BR', { sensitivity: 'base' });
    return comparacao * fator;
  });
}

/** Divide o texto em trechos, marcando as ocorrências dos termos da busca. */
export function destacar(texto: string, termos: string[]): TrechoDestacado[] {
  if (!texto || termos.length === 0) {
    return [{ texto, destaque: false }];
  }
  const chave = normalizar(texto);
  const marcado: boolean[] = new Array(texto.length).fill(false);
  for (const termo of termos) {
    for (let i = chave.indexOf(termo); i !== -1; i = chave.indexOf(termo, i + 1)) {
      marcado.fill(true, i, i + termo.length);
    }
  }

  const trechos: TrechoDestacado[] = [];
  for (let i = 0; i < texto.length; i++) {
    const ultimo = trechos.at(-1);
    if (ultimo && ultimo.destaque === marcado[i]) {
      ultimo.texto += texto[i];
    } else {
      trechos.push({ texto: texto[i], destaque: marcado[i] });
    }
  }
  return trechos;
}
