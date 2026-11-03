import {
  destacar,
  filtrar,
  indexar,
  normalizar,
  ordenar,
  situacaoDoEstoque,
  termosDaBusca,
} from './produto-filtro';
import { Produto } from './produto.model';

function produto(nome: string, quantidadeEmEstoque: number, preco = 10, descricao = ''): Produto {
  return {
    id: nome,
    nome,
    descricao,
    preco,
    quantidadeEmEstoque,
    criadoEm: '2026-11-01T10:00:00Z',
    atualizadoEm: '2026-11-01T10:00:00Z',
    versao: 0,
  };
}

describe('produto-filtro', () => {
  const catalogo = [
    produto('Café Especial', 0, 39.9, 'Grãos torrados'),
    produto('Caneca de Cerâmica', 3, 45),
    produto('Açúcar Mascavo', 40, 12.5),
  ];

  it('normalizar remove acentos e preserva o tamanho do texto', () => {
    expect(normalizar('Açúcar CAFÉ')).toBe('acucar cafe');
    expect(normalizar('Ação').length).toBe('Ação'.length);
  });

  it('termosDaBusca separa e normaliza os termos', () => {
    expect(termosDaBusca('  Café   ESPECIAL ')).toEqual(['cafe', 'especial']);
    expect(termosDaBusca('   ')).toEqual([]);
  });

  it('situacaoDoEstoque classifica pelo limite de estoque baixo', () => {
    expect(situacaoDoEstoque(0, 5)).toBe('esgotado');
    expect(situacaoDoEstoque(5, 5)).toBe('baixo');
    expect(situacaoDoEstoque(6, 5)).toBe('disponivel');
  });

  it('filtrar ignora acentos, exige todos os termos e busca também na descrição', () => {
    const indice = indexar(catalogo);

    expect(filtrar(indice, ['cafe'], 'todos', 5).map((p) => p.nome)).toEqual(['Café Especial']);
    expect(filtrar(indice, ['graos', 'cafe'], 'todos', 5)).toHaveLength(1);
    expect(filtrar(indice, ['cafe', 'caneca'], 'todos', 5)).toHaveLength(0);
  });

  it('filtrar respeita a situação do estoque', () => {
    const indice = indexar(catalogo);

    expect(filtrar(indice, [], 'esgotado', 5).map((p) => p.nome)).toEqual(['Café Especial']);
    expect(filtrar(indice, [], 'baixo', 5).map((p) => p.nome)).toEqual(['Caneca de Cerâmica']);
    expect(filtrar(indice, [], 'disponivel', 5).map((p) => p.nome)).toEqual(['Açúcar Mascavo']);
  });

  it('ordenar compara textos sem diferenciar acentos e números pelo valor', () => {
    expect(ordenar(catalogo, { coluna: 'nome', direcao: 'asc' }).map((p) => p.nome)).toEqual([
      'Açúcar Mascavo',
      'Café Especial',
      'Caneca de Cerâmica',
    ]);
    expect(
      ordenar(catalogo, { coluna: 'preco', direcao: 'desc' }).map((p) => p.preco),
    ).toEqual([45, 39.9, 12.5]);
  });

  it('destacar marca as ocorrências no texto original', () => {
    expect(destacar('Café Especial', ['cafe'])).toEqual([
      { texto: 'Café', destaque: true },
      { texto: ' Especial', destaque: false },
    ]);
    expect(destacar('Caneca', [])).toEqual([{ texto: 'Caneca', destaque: false }]);
  });
});
