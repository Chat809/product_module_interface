/** Colunas JSON cujo conteúdo é livre e não deve ter as chaves convertidas. */
const CONTEUDO_LIVRE = new Set([
  'extras',
  'payload',
  'alteracoes',
  'configuracao',
  'dados',
  'opcoes',
  'valor',
  'checklist',
  'itens',
  'respostas',
]);

const camel = (texto: string) => texto.replace(/_([a-z0-9])/g, (_, letra: string) => letra.toUpperCase());
const snake = (texto: string) => texto.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) && !(valor instanceof Date);
}

function converter(valor: unknown, chave: (texto: string) => string): unknown {
  if (Array.isArray(valor)) {
    return valor.map((item) => converter(item, chave));
  }
  if (!ehObjeto(valor)) {
    return valor;
  }
  return Object.fromEntries(
    Object.entries(valor).map(([nome, conteudo]) => [
      chave(nome),
      CONTEUDO_LIVRE.has(nome) || CONTEUDO_LIVRE.has(camel(nome)) ? conteudo : converter(conteudo, chave),
    ]),
  );
}

/** Linhas do banco (snake_case) no formato das telas (camelCase), inclusive relações embutidas. */
export function paraCamel<T = Record<string, unknown>>(valor: unknown): T {
  return converter(valor, camel) as T;
}

/** Dados das telas no formato das colunas do banco. */
export function paraSnake(valor: unknown): Record<string, unknown> {
  return converter(valor, snake) as Record<string, unknown>;
}

export const colunaDe = snake;
