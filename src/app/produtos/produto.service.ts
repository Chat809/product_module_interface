import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { RepositorioSupabase } from '../core/supabase/repositorio';
import { erroHttp } from '../core/supabase/erros';
import { SupabaseService } from '../core/supabase/supabase.service';
import {
  Movimentacao,
  MovimentacaoRequest,
  Pagina,
  Produto,
  ProdutoRequest,
  ResumoEstoque,
} from './produto.model';

/** O painel carrega o catálogo inteiro de uma vez e filtra no navegador. */
export const TAMANHO_CATALOGO = 1000;
const LIMITE_PADRAO = 5;

const CONFLITO_DE_VERSAO =
  'Este produto foi alterado por outra pessoa. Os dados foram atualizados; revise e tente de novo.';

@Injectable({ providedIn: 'root' })
export class ProdutoService {
  private readonly supabase = inject(SupabaseService);
  private readonly produtos = new RepositorioSupabase<Produto>(this.supabase, {
    tabela: 'produtos',
    ordem: [{ coluna: 'nome' }],
  });
  private readonly movimentacoes = new RepositorioSupabase<Movimentacao>(this.supabase, {
    tabela: 'movimentacoes_estoque',
    ordem: [
      { coluna: 'criado_em', crescente: false },
      { coluna: 'id', crescente: false },
    ],
  });

  listarCatalogo(): Observable<Produto[]> {
    return this.produtos.todos();
  }

  buscarPorId(id: string): Observable<Produto> {
    return this.produtos.buscar(id);
  }

  criar(produto: ProdutoRequest): Observable<Produto> {
    const { versao, ...dados } = produto;
    return this.produtos.criar(dados);
  }

  /** Grava só se a versão ainda for a lida; se outra pessoa salvou antes, nenhuma linha muda e vira 409. */
  atualizar(id: string, produto: ProdutoRequest): Observable<Produto> {
    const { versao, ...dados } = produto;
    return this.supabase
      .executar<Produto[]>(() => {
        let consulta = this.supabase.cliente.from('produtos').update(this.supabase.paraSnake(dados)).eq('id', id);
        if (versao != null) {
          consulta = consulta.eq('versao', versao);
        }
        return consulta.select();
      })
      .pipe(
        map((linhas) => {
          if (!linhas.length) {
            throw this.supabase.falha(erroHttp(409, CONFLITO_DE_VERSAO), { conflito: CONFLITO_DE_VERSAO });
          }
          return linhas[0];
        }),
      );
  }

  remover(id: string): Observable<void> {
    return this.produtos.excluir(id);
  }

  /** O banco trava o produto e confere o saldo, então duas saídas simultâneas não deixam o estoque negativo. */
  movimentar(id: string, movimentacao: MovimentacaoRequest): Observable<Movimentacao> {
    return this.supabase
      .rpc<Movimentacao[]>('registrar_movimentacao', {
        p_produto_id: id,
        p_tipo: movimentacao.tipo,
        p_quantidade: movimentacao.quantidade,
        p_motivo: movimentacao.motivo?.trim() || null,
        p_usuario: null,
      })
      .pipe(
        map((linhas) => {
          if (!linhas.length) {
            throw this.supabase.falha(erroHttp(404, 'Produto não encontrado.'));
          }
          return linhas[0];
        }),
      );
  }

  historico(id: string, tamanho = 5): Observable<Pagina<Movimentacao>> {
    return this.movimentacoes.listar({}, 0, tamanho, { produtoId: id });
  }

  categorias(): Observable<string[]> {
    return this.supabase
      .executar<{ categoria: string }[]>(() =>
        this.supabase.cliente.from('produtos').select('categoria').not('categoria', 'is', null).order('categoria').limit(TAMANHO_CATALOGO),
      )
      .pipe(map((linhas) => [...new Set(linhas.map((l) => l.categoria))]));
  }

  /** O limite de estoque baixo vem de `parametros_sistema.estoque`; sem ele, vale 5. */
  resumo(): Observable<ResumoEstoque> {
    return this.supabase
      .executar<{ valor: { limite_baixo?: number } }[]>(
        () => this.supabase.cliente.from('parametros_sistema').select('valor').eq('chave', 'estoque'),
        { silencioso: true },
      )
      .pipe(
        map((linhas) => linhas[0]?.valor?.limite_baixo ?? LIMITE_PADRAO),
        catchError(() => of(LIMITE_PADRAO)),
        switchMap((limite) =>
          this.supabase
            .rpc<Omit<ResumoEstoque, 'limiteEstoqueBaixo'>>('resumo_estoque', { p_limite: limite })
            .pipe(map((resumo) => ({ ...resumo, limiteEstoqueBaixo: limite }))),
        ),
      );
  }
}
