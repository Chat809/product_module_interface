import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { RepositorioSupabase } from '../core/supabase/repositorio';
import { erroHttp } from '../core/supabase/erros';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Pagina } from '../produtos/produto.model';
import { FiltroCadastro } from '../shared/lista-cadastro/lista-cadastro';
import {
  CentroCusto,
  Conta,
  ContaRequest,
  FiltroContas,
  Fornecedor,
  ResumoFinanceiro,
  TIPOS_DE_CONTA,
  TipoConta,
  hojeIso,
} from './financeiro.model';

/** Colunas que mudam de nome entre contas a pagar e a receber. */
const COLUNAS: Record<TipoConta, { tabela: string; pessoa: string; data: string; vinculo: string }> = {
  'contas-pagar': { tabela: 'contas_pagar', pessoa: 'favorecido', data: 'data_pagamento', vinculo: 'fornecedor_id' },
  'contas-receber': { tabela: 'contas_receber', pessoa: 'pagador', data: 'data_recebimento', vinculo: 'cliente_id' },
};

const camel = (coluna: string) => coluna.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());

export interface DadosDaBaixa {
  data: string;
  juros?: number | null;
  multa?: number | null;
  desconto?: number | null;
  contaBancariaId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class FinanceiroService {
  private readonly supabase = inject(SupabaseService);

  private readonly fornecedores = new RepositorioSupabase<Fornecedor>(this.supabase, {
    tabela: 'fornecedores',
    ordem: [{ coluna: 'razao_social' }, { coluna: 'id' }],
    busca: ['razao_social', 'nome_fantasia', 'categoria', 'email', 'documento'],
  });
  private readonly centros = new RepositorioSupabase<CentroCusto>(this.supabase, {
    tabela: 'centros_custo',
    ordem: [{ coluna: 'codigo' }],
    busca: ['codigo', 'nome', 'descricao'],
  });

  /** Linha do banco no formato `Conta` das telas. */
  paraConta(tipo: TipoConta, linha: Record<string, unknown>): Conta {
    const colunas = COLUNAS[tipo];
    const conta = linha as unknown as Conta & Record<string, unknown>;
    return {
      ...conta,
      pessoa: linha[camel(colunas.pessoa)] as string,
      dataBaixa: (linha[camel(colunas.data)] as string | null) ?? null,
      vinculoId: (linha[camel(colunas.vinculo)] as string | null) ?? null,
      vencida: conta.status === 'PENDENTE' && conta.vencimento < hojeIso(),
    };
  }

  private repositorio(tipo: TipoConta): RepositorioSupabase<Record<string, unknown>> {
    const colunas = COLUNAS[tipo];
    return new RepositorioSupabase<Record<string, unknown>>(this.supabase, {
      tabela: colunas.tabela,
      ordem: [{ coluna: 'vencimento' }, { coluna: 'criado_em' }],
      busca: ['descricao', colunas.pessoa, 'documento', 'categoria'],
    });
  }

  /** Dados do formulário nas colunas do tipo; a chave Pix é obrigatória no Pix. */
  private dadosDa(tipo: TipoConta, dados: ContaRequest): Record<string, unknown> {
    const colunas = COLUNAS[tipo];
    const { pessoa, vinculoId, documento, ...resto } = dados;
    return {
      ...resto,
      documento: documento ? documento.replace(/\D/g, '') || null : null,
      [camel(colunas.pessoa)]: pessoa,
      [camel(colunas.vinculo)]: vinculoId,
    };
  }

  resumo(): Observable<ResumoFinanceiro> {
    return this.supabase
      .rpc<Omit<ResumoFinanceiro, 'saldoPrevisto'>>('resumo_financeiro', { p_hoje: hojeIso() })
      .pipe(map((resumo) => ({ ...resumo, saldoPrevisto: resumo.aReceber - resumo.aPagar })));
  }

  listar(tipo: TipoConta, filtro: FiltroContas, pagina: number, tamanho: number): Observable<Pagina<Conta>> {
    if (filtro.vencimentoDe && filtro.vencimentoAte && filtro.vencimentoDe > filtro.vencimentoAte) {
      return this.recusar('A data inicial do vencimento deve ser anterior ou igual à final.');
    }
    const hoje = hojeIso();
    return this.repositorio(tipo)
      .listar({ busca: filtro.busca }, pagina, tamanho, {}, (consulta) => {
        switch (filtro.situacao) {
          case 'VENCIDAS':
            consulta = consulta.eq('status', 'PENDENTE').lt('vencimento', hoje);
            break;
          case 'QUITADA':
            consulta = consulta.eq('status', TIPOS_DE_CONTA[tipo].quitado);
            break;
          case 'PENDENTE':
          case 'CANCELADO':
            consulta = consulta.eq('status', filtro.situacao);
            break;
        }
        if (filtro.vencimentoDe) {
          consulta = consulta.gte('vencimento', filtro.vencimentoDe);
        }
        if (filtro.vencimentoAte) {
          consulta = consulta.lte('vencimento', filtro.vencimentoAte);
        }
        return consulta;
      })
      .pipe(map((p) => ({ ...p, conteudo: p.conteudo.map((linha) => this.paraConta(tipo, linha)) })));
  }

  contasDoCliente(clienteId: string): Observable<Pagina<Conta>> {
    return this.repositorio('contas-receber')
      .listar({}, 0, 50, { clienteId })
      .pipe(map((p) => ({ ...p, conteudo: p.conteudo.map((linha) => this.paraConta('contas-receber', linha)) })));
  }

  buscar(tipo: TipoConta, id: string): Observable<Conta> {
    return this.repositorio(tipo)
      .buscar(id)
      .pipe(map((linha) => this.paraConta(tipo, linha)));
  }

  criar(tipo: TipoConta, dados: ContaRequest): Observable<Conta> {
    if (dados.formaPagamento === 'PIX' && !dados.chavePix?.trim()) {
      return this.recusar('Informe a chave Pix quando a forma de pagamento for PIX.');
    }
    return this.repositorio(tipo)
      .criar(this.dadosDa(tipo, dados))
      .pipe(map((linha) => this.paraConta(tipo, linha)));
  }

  atualizar(tipo: TipoConta, id: string, dados: ContaRequest): Observable<Conta> {
    if (dados.formaPagamento === 'PIX' && !dados.chavePix?.trim()) {
      return this.recusar('Informe a chave Pix quando a forma de pagamento for PIX.');
    }
    return this.repositorio(tipo)
      .atualizar(id, this.dadosDa(tipo, dados))
      .pipe(map((linha) => this.paraConta(tipo, linha)));
  }

  /** Só contas pendentes recebem baixa; o lançamento no caixa é criado por gatilho. */
  baixar(tipo: TipoConta, id: string, baixa: string | DadosDaBaixa): Observable<Conta> {
    const dados: DadosDaBaixa = typeof baixa === 'string' ? { data: baixa } : baixa;
    if (dados.data > hojeIso()) {
      return this.recusar('A data da baixa não pode ser futura.');
    }
    const colunas = COLUNAS[tipo];
    const alteracoes: Record<string, unknown> = {
      status: TIPOS_DE_CONTA[tipo].quitado,
      [camel(colunas.data)]: dados.data,
    };
    for (const campo of ['juros', 'multa', 'desconto', 'contaBancariaId'] as const) {
      if (dados[campo] !== undefined) {
        alteracoes[campo] = dados[campo];
      }
    }
    return this.mudarPendente(tipo, id, alteracoes);
  }

  cancelar(tipo: TipoConta, id: string): Observable<Conta> {
    return this.mudarPendente(tipo, id, { status: 'CANCELADO' });
  }

  excluir(tipo: TipoConta, id: string): Observable<void> {
    return this.repositorio(tipo).excluir(id);
  }

  /** Divide a conta em parcelas mensais iguais (função `parcelar_conta`). */
  parcelar(tipo: TipoConta, id: string, parcelas: number): Observable<string> {
    return this.supabase.rpc<string>('parcelar_conta', {
      p_tipo: tipo === 'contas-pagar' ? 'PAGAR' : 'RECEBER',
      p_id: id,
      p_parcelas: parcelas,
    });
  }

  listarFornecedores(filtro: FiltroCadastro, pagina: number, tamanho: number): Observable<Pagina<Fornecedor>> {
    return this.fornecedores.listar(filtro, pagina, tamanho);
  }

  opcoesDeFornecedores(): Observable<Fornecedor[]> {
    return this.fornecedores.todos({ ativo: true });
  }

  salvarFornecedor(id: string | null, dados: Record<string, unknown>): Observable<Fornecedor> {
    const documento = typeof dados['documento'] === 'string' ? dados['documento'].replace(/\D/g, '') || null : dados['documento'];
    if (documento && ![11, 14].includes(String(documento).length)) {
      return this.recusar('O documento deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos).');
    }
    return this.fornecedores.salvar(id, { ...dados, documento });
  }

  excluirFornecedor(id: string): Observable<void> {
    return this.fornecedores.excluir(id);
  }

  listarCentros(filtro: FiltroCadastro, pagina: number, tamanho: number): Observable<Pagina<CentroCusto>> {
    return this.centros.listar(filtro, pagina, tamanho);
  }

  opcoesDeCentros(): Observable<CentroCusto[]> {
    return this.centros.todos({ ativo: true });
  }

  salvarCentro(id: string | null, dados: Record<string, unknown>): Observable<CentroCusto> {
    return this.centros.salvar(id, dados);
  }

  excluirCentro(id: string): Observable<void> {
    return this.centros.excluir(id);
  }

  private mudarPendente(tipo: TipoConta, id: string, alteracoes: Record<string, unknown>): Observable<Conta> {
    return this.repositorio(tipo)
      .buscar(id)
      .pipe(
        switchMap((linha) => {
          if (linha['status'] !== 'PENDENTE') {
            throw this.supabase.falha(erroHttp(422, 'Só contas pendentes podem receber baixa ou ser canceladas.'));
          }
          return this.repositorio(tipo).atualizar(id, alteracoes, (consulta) => consulta.eq('status', 'PENDENTE'));
        }),
        map((linha) => this.paraConta(tipo, linha)),
      );
  }

  private recusar<T>(mensagem: string): Observable<T> {
    return new Observable<T>((assinante) => assinante.error(this.supabase.falha(erroHttp(400, mensagem))));
  }
}
