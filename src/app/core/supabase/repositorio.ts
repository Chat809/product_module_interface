import { Observable, map } from 'rxjs';
import { colunaDe, paraSnake } from './caixa';
import { erroHttp } from './erros';
import { OpcoesDeExecucao, SupabaseService } from './supabase.service';

export interface Pagina<T> {
  conteudo: T[];
  pagina: number;
  tamanho: number;
  totalElementos: number;
  totalPaginas: number;
}

export interface Ordem {
  coluna: string;
  crescente?: boolean;
  nulosPorUltimo?: boolean;
}

export interface FiltroDeLista {
  busca?: string;
  /** `null` ou ausente mostra ativos e inativos. */
  ativo?: boolean | null;
}

/** Ajuste livre na consulta do supabase-js (filtros de intervalo, `in`, `or` etc.). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AjusteDeConsulta = (consulta: any) => any;

export interface DefinicaoDeRepositorio {
  tabela: string;
  selecao?: string;
  ordem?: Ordem[];
  /** Colunas pesquisadas com `ilike` pela busca da lista. */
  busca?: string[];
}

/** Limite de linhas das consultas sem paginação, igual ao que a API usava. */
export const LIMITE_SEM_PAGINA = 1000;

/** Remove os caracteres que quebram a sintaxe de `or` do PostgREST. */
export function termoDeBusca(texto: string | null | undefined): string {
  return (texto ?? '').replace(/[,()"*\\%]/g, ' ').trim();
}

export function buscaEm(termo: string, colunas: string[]): string {
  return colunas.map((coluna) => `${coluna}.ilike.*${termo}*`).join(',');
}

export function paginaVazia<T>(pagina: number, tamanho: number): Pagina<T> {
  return { conteudo: [], pagina, tamanho, totalElementos: 0, totalPaginas: 0 };
}

/**
 * CRUD de uma tabela pelo supabase-js, no formato das telas: camelCase, `Pagina<T>` e erros já traduzidos.
 * Quem pode ler ou gravar é decidido pelas políticas de RLS da tabela.
 */
export class RepositorioSupabase<T> {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly definicao: DefinicaoDeRepositorio,
  ) {}

  private get selecao(): string {
    return this.definicao.selecao ?? '*';
  }

  private ordenar(consulta: ReturnType<AjusteDeConsulta>, ordem = this.definicao.ordem ?? [{ coluna: 'criado_em', crescente: false }]) {
    for (const { coluna, crescente = true, nulosPorUltimo } of ordem) {
      consulta = consulta.order(coluna, { ascending: crescente, nullsFirst: nulosPorUltimo === undefined ? undefined : !nulosPorUltimo });
    }
    return consulta;
  }

  /** Igualdade em cada filtro preenchido; as chaves podem vir em camelCase. */
  private filtrar(consulta: ReturnType<AjusteDeConsulta>, filtros: Record<string, unknown>) {
    for (const [chave, valor] of Object.entries(filtros)) {
      if (valor !== null && valor !== undefined && valor !== '') {
        consulta = consulta.eq(colunaDe(chave), valor);
      }
    }
    return consulta;
  }

  listar(
    filtro: FiltroDeLista,
    pagina: number,
    tamanho: number,
    filtros: Record<string, unknown> = {},
    ajuste?: AjusteDeConsulta,
    opcoes?: OpcoesDeExecucao,
  ): Observable<Pagina<T>> {
    return this.supabase
      .executar<{ linhas: T[]; total: number }>(() => {
        let consulta = this.supabase.cliente.from(this.definicao.tabela).select(this.selecao, { count: 'exact' });
        consulta = this.filtrar(consulta, filtros);
        if (filtro.ativo !== null && filtro.ativo !== undefined) {
          consulta = consulta.eq('ativo', filtro.ativo);
        }
        const termo = termoDeBusca(filtro.busca);
        if (termo && this.definicao.busca?.length) {
          consulta = consulta.or(buscaEm(termo, this.definicao.busca));
        }
        if (ajuste) {
          consulta = ajuste(consulta);
        }
        const inicio = pagina * tamanho;
        return this.ordenar(consulta)
          .range(inicio, inicio + tamanho - 1)
          .then((r: { data: unknown; error: unknown; count: number | null }) => ({
            data: { linhas: r.data ?? [], total: r.count ?? 0 },
            error: r.error,
          }));
      }, opcoes)
      .pipe(
        map(({ linhas, total }) => ({
          conteudo: linhas,
          pagina,
          tamanho,
          totalElementos: total,
          totalPaginas: Math.ceil(total / tamanho),
        })),
      );
  }

  todos(filtros: Record<string, unknown> = {}, ajuste?: AjusteDeConsulta, ordem?: Ordem[], opcoes?: OpcoesDeExecucao): Observable<T[]> {
    return this.supabase.executar<T[]>(() => {
      let consulta = this.filtrar(this.supabase.cliente.from(this.definicao.tabela).select(this.selecao), filtros);
      if (ajuste) {
        consulta = ajuste(consulta);
      }
      return this.ordenar(consulta, ordem).limit(LIMITE_SEM_PAGINA);
    }, opcoes);
  }

  buscar(id: string, opcoes?: OpcoesDeExecucao): Observable<T> {
    return this.supabase.executar<T>(
      () => this.supabase.cliente.from(this.definicao.tabela).select(this.selecao).eq('id', id).single(),
      opcoes,
    );
  }

  criar(dados: Record<string, unknown>, opcoes?: OpcoesDeExecucao): Observable<T> {
    return this.supabase.executar<T>(
      () => this.supabase.cliente.from(this.definicao.tabela).insert(paraSnake(dados)).select(this.selecao).single(),
      opcoes,
    );
  }

  atualizar(id: string, dados: Record<string, unknown>, ajuste?: AjusteDeConsulta, opcoes?: OpcoesDeExecucao): Observable<T> {
    return this.supabase.executar<T>(() => {
      let consulta = this.supabase.cliente.from(this.definicao.tabela).update(paraSnake(dados)).eq('id', id);
      if (ajuste) {
        consulta = ajuste(consulta);
      }
      return consulta.select(this.selecao).single();
    }, opcoes);
  }

  salvar(id: string | null, dados: Record<string, unknown>, opcoes?: OpcoesDeExecucao): Observable<T> {
    return id ? this.atualizar(id, dados, undefined, opcoes) : this.criar(dados, opcoes);
  }

  /** Sem linha afetada é 404: o registro não existe ou a política não deixa excluí-lo. */
  excluir(id: string, opcoes?: OpcoesDeExecucao): Observable<void> {
    return this.supabase
      .executar<{ id: string }[]>(
        () => this.supabase.cliente.from(this.definicao.tabela).delete().eq('id', id).select('id'),
        opcoes,
      )
      .pipe(
        map((linhas) => {
          if (!linhas.length) {
            throw this.supabase.falha(erroHttp(404, 'Registro não encontrado ou sem permissão para excluir.'), opcoes);
          }
        }),
      );
  }
}
