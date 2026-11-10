export type UnidadeMedida = 'UN' | 'PC' | 'CX' | 'KIT' | 'PAR' | 'KG' | 'G' | 'L' | 'ML' | 'M' | 'M2';

export const UNIDADES: { valor: UnidadeMedida; rotulo: string }[] = [
  { valor: 'UN', rotulo: 'Unidade (UN)' },
  { valor: 'PC', rotulo: 'Peça (PC)' },
  { valor: 'CX', rotulo: 'Caixa (CX)' },
  { valor: 'KIT', rotulo: 'Kit (KIT)' },
  { valor: 'PAR', rotulo: 'Par (PAR)' },
  { valor: 'KG', rotulo: 'Quilograma (KG)' },
  { valor: 'G', rotulo: 'Grama (G)' },
  { valor: 'L', rotulo: 'Litro (L)' },
  { valor: 'ML', rotulo: 'Mililitro (ML)' },
  { valor: 'M', rotulo: 'Metro (M)' },
  { valor: 'M2', rotulo: 'Metro quadrado (M2)' },
];

/** Espelha o ProdutoResponseDTO da API. */
export interface Produto {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  unidade: UnidadeMedida;
  preco: number;
  custo: number | null;
  quantidadeEmEstoque: number;
  /** Inativos continuam no catálogo, mas saem dos indicadores do dashboard. */
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  /** Usada no PUT para a API recusar (409) a edição de um produto alterado por outra pessoa. */
  versao: number;
}

/** Espelha o ProdutoRequestDTO da API. */
export interface ProdutoRequest {
  codigo: string | null;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  unidade: UnidadeMedida;
  preco: number;
  custo: number | null;
  quantidadeEmEstoque: number;
  ativo: boolean;
  versao?: number;
}

export type { Pagina } from '../core/supabase/repositorio';

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
