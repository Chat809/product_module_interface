import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { RepositorioSupabase, buscaEm, termoDeBusca } from '../core/supabase/repositorio';
import { erroHttp } from '../core/supabase/erros';
import { SupabaseService } from '../core/supabase/supabase.service';
import { UsuarioOpcao } from '../demandas/demanda.model';
import { Conta } from '../financeiro/financeiro.model';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { Pagina } from '../produtos/produto.model';
import { FiltroCadastro } from '../shared/lista-cadastro/lista-cadastro';
import {
  Cliente,
  CrmEtapa,
  CrmOrigem,
  Interacao,
  Lead,
  Reclamacao,
  ReclamacaoEvento,
  StatusReclamacao,
  TipoInteracao,
} from './crm.model';

export interface FiltroLeads {
  etapaId?: string | null;
  origemId?: string | null;
  responsavelId?: string | null;
}

export interface FiltroReclamacoes {
  status?: StatusReclamacao | null;
  responsavelId?: string | null;
}

const COM_CLIENTE = '*, cliente:clientes(id, nome)';

/** CPF/CNPJ gravados só com dígitos, como a busca e a formatação esperam. */
function soDigitos(dados: Record<string, unknown>): Record<string, unknown> {
  return typeof dados['documento'] === 'string' ? { ...dados, documento: dados['documento'].replace(/\D/g, '') || null } : dados;
}

@Injectable({ providedIn: 'root' })
export class CrmService {
  private readonly supabase = inject(SupabaseService);
  private readonly financeiro = inject(FinanceiroService);

  private readonly clientes = new RepositorioSupabase<Cliente>(this.supabase, {
    tabela: 'clientes',
    ordem: [{ coluna: 'nome' }, { coluna: 'id' }],
    busca: ['nome', 'email', 'telefone', 'cidade', 'documento'],
  });
  private readonly leads = new RepositorioSupabase<Lead>(this.supabase, {
    tabela: 'leads',
    ordem: [{ coluna: 'criado_em', crescente: false }, { coluna: 'id' }],
    busca: ['nome', 'empresa', 'email', 'telefone'],
  });
  private readonly reclamacoes = new RepositorioSupabase<Reclamacao>(this.supabase, {
    tabela: 'reclamacoes',
    selecao: COM_CLIENTE,
    ordem: [{ coluna: 'criado_em', crescente: false }, { coluna: 'id' }],
    busca: ['protocolo', 'assunto', 'nome_contato', 'contato'],
  });
  private readonly interacoes = new RepositorioSupabase<Interacao>(this.supabase, {
    tabela: 'crm_interacoes',
    ordem: [{ coluna: 'criado_em', crescente: false }],
  });
  private readonly eventos = new RepositorioSupabase<ReclamacaoEvento>(this.supabase, {
    tabela: 'reclamacao_eventos',
    ordem: [{ coluna: 'criado_em' }],
  });
  private readonly etapasCrm = new RepositorioSupabase<CrmEtapa>(this.supabase, {
    tabela: 'crm_etapas',
    ordem: [{ coluna: 'ordem' }, { coluna: 'nome' }],
  });
  private readonly origensCrm = new RepositorioSupabase<CrmOrigem>(this.supabase, {
    tabela: 'crm_origens',
    ordem: [{ coluna: 'nome' }],
  });

  responsaveis(): Observable<UsuarioOpcao[]> {
    return this.supabase.rpc<UsuarioOpcao[]>('opcoes_usuarios');
  }

  listarClientes(filtro: FiltroCadastro, pagina: number, tamanho: number): Observable<Pagina<Cliente>> {
    return this.clientes.listar(filtro, pagina, tamanho);
  }

  opcoesDeClientes(): Observable<Cliente[]> {
    return this.clientes.todos({ ativo: true });
  }

  buscarCliente(id: string): Observable<Cliente> {
    return this.clientes.buscar(id);
  }

  salvarCliente(id: string | null, dados: Record<string, unknown>): Observable<Cliente> {
    return this.clientes.salvar(id, soDigitos(dados));
  }

  excluirCliente(id: string): Observable<void> {
    return this.clientes.excluir(id);
  }

  interacoesDoCliente(id: string): Observable<Interacao[]> {
    return this.interacoes.todos({ clienteId: id });
  }

  registrarInteracaoNoCliente(id: string, tipo: TipoInteracao, descricao: string): Observable<Interacao> {
    return this.interacoes.criar({ clienteId: id, tipo, descricao: descricao.trim() });
  }

  reclamacoesDoCliente(id: string): Observable<Reclamacao[]> {
    return this.reclamacoes.todos({ clienteId: id });
  }

  /** Contas a receber ligadas ao cliente; exige a subaba Contas a receber. */
  contasDoCliente(id: string): Observable<Pagina<Conta>> {
    return this.financeiro.contasDoCliente(id);
  }

  listarLeads(filtro: FiltroCadastro, extras: FiltroLeads, pagina: number, tamanho: number): Observable<Pagina<Lead>> {
    return this.leads.listar(filtro, pagina, tamanho, { ...extras });
  }

  funil(busca: string, responsavelId: string | null): Observable<Lead[]> {
    const termo = termoDeBusca(busca);
    return this.leads.todos(
      { responsavelId },
      termo ? (consulta) => consulta.or(buscaEm(termo, ['nome', 'empresa', 'email', 'telefone'])) : undefined,
      [{ coluna: 'ordem' }],
    );
  }

  /** Sem etapa escolhida, o lead entra na primeira etapa aberta e ativa do funil. A etapa muda só por {@link moverLead}. */
  salvarLead(id: string | null, dados: Record<string, unknown>): Observable<Lead> {
    if (id) {
      const { etapaId, ...resto } = dados;
      return this.leads.atualizar(id, resto);
    }
    const etapa$ = dados['etapaId'] ? of(dados['etapaId'] as string) : this.primeiraEtapa();
    return etapa$.pipe(switchMap((etapaId) => this.leads.criar({ ...dados, etapaId })));
  }

  moverLead(id: string, etapaId: string, ordem: number | null, motivoPerda: string | null = null): Observable<Lead> {
    return forkJoin({ atual: this.leads.buscar(id), etapas: this.etapasCrm.todos() }).pipe(
      switchMap(({ atual, etapas }) => {
        const destino = etapas.find((e) => e.id === etapaId);
        if (!destino) {
          throw this.supabase.falha(erroHttp(404, 'Etapa não encontrada.'));
        }
        if (!destino.ativo) {
          throw this.supabase.falha(erroHttp(400, `A etapa "${destino.nome}" está inativa.`));
        }
        const motivo = motivoPerda?.trim() || null;
        const perdido = destino.tipo === 'PERDIDO';
        if (perdido && !motivo && !atual.motivoPerda) {
          throw this.supabase.falha(erroHttp(400, 'Informe o motivo da perda.'));
        }
        return this.leads
          .atualizar(id, {
            etapaId,
            ordem: ordem ?? Date.now() / 1000,
            motivoPerda: perdido ? (motivo ?? atual.motivoPerda) : null,
          })
          .pipe(
            switchMap((movido) => {
              if (atual.etapaId === etapaId) {
                return of(movido);
              }
              const origem = etapas.find((e) => e.id === atual.etapaId)?.nome ?? '?';
              const nota =
                `Etapa alterada de "${origem}" para "${destino.nome}"` +
                (perdido && movido.motivoPerda ? `. Motivo: ${movido.motivoPerda}` : '.');
              return this.interacoes.criar({ leadId: id, tipo: 'NOTA', descricao: nota }).pipe(map(() => movido));
            }),
          );
      }),
    );
  }

  /** Cria o cliente com os dados do lead e leva o lead à etapa de ganho (função `converter_lead`). */
  converterLead(id: string): Observable<Lead> {
    return this.supabase.rpc<Lead[]>('converter_lead', { p_lead_id: id }).pipe(
      map((linhas) => {
        if (!linhas.length) {
          throw this.supabase.falha(erroHttp(404, 'Lead não encontrado.'));
        }
        return linhas[0];
      }),
    );
  }

  excluirLead(id: string): Observable<void> {
    return this.leads.excluir(id);
  }

  interacoesDoLead(id: string): Observable<Interacao[]> {
    return this.interacoes.todos({ leadId: id });
  }

  registrarInteracaoNoLead(id: string, tipo: TipoInteracao, descricao: string): Observable<Interacao> {
    return this.interacoes.criar({ leadId: id, tipo, descricao: descricao.trim() });
  }

  listarReclamacoes(
    filtro: FiltroCadastro,
    extras: FiltroReclamacoes,
    pagina: number,
    tamanho: number,
  ): Observable<Pagina<Reclamacao>> {
    return this.reclamacoes.listar(filtro, pagina, tamanho, { ...extras });
  }

  /** As de prazo mais próximo primeiro; o painel agrupa por status. */
  quadroDeReclamacoes(busca: string, responsavelId: string | null): Observable<Reclamacao[]> {
    const termo = termoDeBusca(busca);
    return this.reclamacoes.todos(
      { responsavelId },
      termo ? (consulta) => consulta.or(buscaEm(termo, ['protocolo', 'assunto', 'nome_contato', 'contato'])) : undefined,
      [{ coluna: 'prazo', nulosPorUltimo: true }, { coluna: 'criado_em' }],
    );
  }

  salvarReclamacao(id: string | null, dados: Record<string, unknown>): Observable<Reclamacao> {
    if (!dados['clienteId'] && !dados['nomeContato']) {
      return this.recusar('Selecione o cliente ou informe o nome de quem reclamou.');
    }
    return this.reclamacoes.salvar(id, dados);
  }

  /** O histórico de status é gravado por gatilho; o comentário opcional vira um evento à parte. */
  alterarStatus(
    id: string,
    status: StatusReclamacao,
    solucao: string | null = null,
    comentario: string | null = null,
  ): Observable<Reclamacao> {
    const textoSolucao = solucao?.trim() || null;
    const textoComentario = comentario?.trim() || null;
    return this.reclamacoes.buscar(id).pipe(
      switchMap((atual) => {
        if (status === 'RESOLVIDA' && !textoSolucao && !atual.solucao) {
          return this.recusar<Reclamacao>('Descreva a solução para marcar a reclamação como resolvida.');
        }
        return this.reclamacoes.atualizar(id, textoSolucao ? { status, solucao: textoSolucao } : { status });
      }),
      switchMap((alterada) =>
        textoComentario ? this.comentar(id, textoComentario).pipe(map(() => alterada)) : of(alterada),
      ),
    );
  }

  historico(id: string): Observable<ReclamacaoEvento[]> {
    return this.eventos.todos({ reclamacaoId: id });
  }

  comentar(id: string, comentario: string): Observable<ReclamacaoEvento> {
    return this.eventos.criar({ reclamacaoId: id, tipo: 'COMENTARIO', comentario: comentario.trim() });
  }

  etapas(): Observable<CrmEtapa[]> {
    return this.etapasCrm.todos();
  }

  salvarEtapa(id: string | null, dados: Record<string, unknown>): Observable<CrmEtapa> {
    return this.etapasCrm.salvar(id, dados);
  }

  excluirEtapa(id: string): Observable<void> {
    return this.etapasCrm.excluir(id);
  }

  origens(): Observable<CrmOrigem[]> {
    return this.origensCrm.todos();
  }

  salvarOrigem(id: string | null, dados: Record<string, unknown>): Observable<CrmOrigem> {
    return this.origensCrm.salvar(id, dados);
  }

  excluirOrigem(id: string): Observable<void> {
    return this.origensCrm.excluir(id);
  }

  private primeiraEtapa(): Observable<string> {
    return this.etapasCrm.todos({ ativo: true, tipo: 'ABERTA' }).pipe(
      map((etapas) => {
        if (!etapas.length) {
          throw this.supabase.falha(erroHttp(422, 'Cadastre uma etapa aberta nos parâmetros do CRM antes de criar leads.'));
        }
        return etapas[0].id;
      }),
    );
  }

  private recusar<T>(mensagem: string): Observable<T> {
    return new Observable<T>((assinante) => assinante.error(this.supabase.falha(erroHttp(400, mensagem))));
  }
}
