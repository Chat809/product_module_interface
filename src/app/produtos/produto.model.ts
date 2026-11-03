/** Espelha o ProdutoResponseDTO da API. */
export interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  quantidadeEmEstoque: number;
  criadoEm: string;
  atualizadoEm: string;
  /** Usada no PUT para a API recusar (409) a edição de um produto alterado por outra pessoa. */
  versao: number;
}

/** Espelha o ProdutoRequestDTO da API. */
export interface ProdutoRequest {
  nome: string;
  descricao: string | null;
  preco: number;
  quantidadeEmEstoque: number;
  versao?: number;
}

export interface Pagina<T> {
  conteudo: T[];
  pagina: number;
  tamanho: number;
  totalElementos: number;
  totalPaginas: number;
}

export type TipoMovimentacao = 'ENTRADA' | 'SAIDA' | 'AJUSTE';

export interface Movimentacao {
  id: string;
  produtoId: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  saldoAnterior: number;
  saldoApos: number;
  motivo: string | null;
  criadoEm: string;
}

/** Ajustes são gerados pela API; o usuário registra apenas entradas e saídas. */
export interface MovimentacaoRequest {
  tipo: Exclude<TipoMovimentacao, 'AJUSTE'>;
  quantidade: number;
  motivo: string | null;
}

export interface ResumoEstoque {
  totalProdutos: number;
  totalItens: number;
  valorTotal: number;
  esgotados: number;
  estoqueBaixo: number;
  limiteEstoqueBaixo: number;
}
