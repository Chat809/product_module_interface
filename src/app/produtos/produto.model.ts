/** Espelha o ProdutoResponseDTO da API. */
export interface Produto {
  id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  quantidadeEmEstoque: number;
}

/** Espelha o ProdutoRequestDTO da API: o id nunca é enviado no corpo. */
export type ProdutoRequest = Omit<Produto, 'id'>;
