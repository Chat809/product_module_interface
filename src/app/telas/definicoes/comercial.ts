import { from, of, switchMap, tap } from 'rxjs';
import { ColunaLinha, editarLinhas } from '../editor-linhas';
import { copiar, data, hojeIso, inicioDoMes, linkPublico, moeda, opcoes, percentual, rotulo } from '../formatos';
import { ContextoTela, FabricaDeTela, Registro } from '../tela.model';
import { CONTA_BANCARIA, FORMAS_DE_PAGAMENTO } from './financeiro';

const STATUS_DA_PROPOSTA: Record<string, string> = { RASCUNHO: 'Rascunho', ENVIADA: 'Enviada', APROVADA: 'Aprovada', RECUSADA: 'Recusada' };
const STATUS_DO_PEDIDO: Record<string, string> = { ABERTO: 'Aberto', FATURADO: 'Faturado', CANCELADO: 'Cancelado' };
const STATUS_DA_COMISSAO: Record<string, string> = { PENDENTE: 'Pendente', APROVADA: 'Aprovada', PAGA: 'Paga', CANCELADA: 'Cancelada' };

const COLUNAS_DE_ITENS: ColunaLinha[] = [
  {
    chave: 'produtoId',
    rotulo: 'Produto',
    tipo: 'select',
    peso: 2,
    fonte: { tabela: 'produtos', filtro: { ativo: true } },
    aoEscolher: (linha, opcao) => {
      if (opcao?.dados) {
        linha['descricao'] = opcao.dados['nome'];
        linha['precoUnitario'] = opcao.dados['preco'];
      }
    },
  },
  { chave: 'descricao', rotulo: 'Descrição', obrigatorio: true, peso: 2 },
  { chave: 'quantidade', rotulo: 'Qtd.', tipo: 'numero', obrigatorio: true },
  { chave: 'precoUnitario', rotulo: 'Preço unit.', tipo: 'numero', obrigatorio: true },
  { chave: 'descontoPercentual', rotulo: 'Desc. %', tipo: 'numero' },
];

function totalDosItens(linhas: Registro[]): string {
  const total = linhas.reduce(
    (soma, l) => soma + Number(l['quantidade'] || 0) * Number(l['precoUnitario'] || 0) * (1 - Number(l['descontoPercentual'] || 0) / 100),
    0,
  );
  return `Total dos itens: ${moeda(total)}`;
}

function editarItens(ctx: ContextoTela, tabela: string, chaveDoPai: string, registro: Registro, titulo: string, somenteLeitura: boolean) {
  return editarLinhas(ctx.dialog, {
    titulo,
    subtitulo: somenteLeitura ? 'Documento encerrado: itens só para consulta.' : 'O desconto geral é aplicado sobre o total dos itens.',
    tabela,
    chaveDoPai,
    paiId: registro['id'],
    colunas: COLUNAS_DE_ITENS,
    colunaDeOrdem: 'ordem',
    novaLinha: () => ({ quantidade: 1, descontoPercentual: 0 }),
    resumo: totalDosItens,
    validar: (linhas) =>
      linhas.some((l) => Number(l['quantidade']) <= 0 || Number(l['precoUnitario']) < 0)
        ? 'Quantidade deve ser maior que zero e preço não pode ser negativo.'
        : null,
    somenteLeitura,
  });
}

/** Cria um link público para o registro e copia o endereço. */
export function gerarLink(ctx: ContextoTela, dados: Record<string, unknown>) {
  return ctx.supabase
    .executar<Registro>(() => ctx.supabase.cliente.from('links_publicos').insert(dados).select('token').single())
    .pipe(
      switchMap((link) => {
        const endereco = linkPublico(link['token']);
        return from(copiar(endereco)).pipe(
          tap((copiou) => ctx.notificacao.sucesso(copiou ? `Link copiado: ${endereco}` : `Link criado: ${endereco}`)),
        );
      }),
    );
}

export const propostas: FabricaDeTela = (ctx) => ({
  abas: [
    {
      titulo: 'Propostas comerciais',
      subtitulo: 'Monte a proposta, envie o link para o cliente aprovar e ela vira pedido automaticamente.',
      rotuloNovo: 'Nova proposta',
      rotuloBusca: 'Buscar por número ou título',
      tabela: 'propostas_comerciais',
      selecao: '*, cliente:clientes(nome), lead:leads(nome)',
      busca: ['numero', 'titulo'],
      entidade: 'propostas_comerciais',
      colunas: [
        { chave: 'titulo', rotulo: 'Proposta', valor: (p) => `${p['numero'] ?? ''} ${p['titulo']}`.trim(), detalhe: (p) => p['cliente']?.['nome'] ?? p['lead']?.['nome'] },
        { chave: 'status', rotulo: 'Situação', valor: (p) => rotulo(STATUS_DA_PROPOSTA, p['status']) },
        { chave: 'validade', rotulo: 'Validade', valor: (p) => data(p['validade']) },
        { chave: 'valorTotal', rotulo: 'Total', valor: (p) => moeda(p['valorTotal']) },
        { chave: 'responsavel', rotulo: 'Responsável', valor: (p) => ctx.nomeDoUsuario(p['responsavelId']) },
      ],
      campos: [
        { chave: 'titulo', rotulo: 'Título', obrigatorio: true, max: 150 },
        { chave: 'clienteId', rotulo: 'Cliente', tipo: 'select', meia: true, fonte: { tabela: 'clientes', filtro: { ativo: true } } },
        { chave: 'leadId', rotulo: 'Lead', tipo: 'select', meia: true, fonte: { tabela: 'leads' } },
        { chave: 'validade', rotulo: 'Validade', tipo: 'data', meia: true },
        { chave: 'tabelaPrecoId', rotulo: 'Tabela de preço', tipo: 'select', meia: true, fonte: { tabela: 'tabelas_preco', filtro: { ativo: true } } },
        { chave: 'responsavelId', rotulo: 'Responsável', tipo: 'select', meia: true, fonte: { usuarios: true } },
        { chave: 'descontoGeral', rotulo: 'Desconto geral (R$)', tipo: 'numero', min: 0, meia: true },
        { chave: 'condicoesPagamento', rotulo: 'Condições de pagamento', max: 300 },
        { chave: 'observacoes', rotulo: 'Observações', tipo: 'textarea', max: 4000 },
      ],
      valoresPadrao: { descontoGeral: 0, responsavelId: ctx.auth.usuario()?.id },
      antesDeSalvar: (d) => ({ ...d, descontoGeral: d['descontoGeral'] ?? 0 }),
      descrever: (p) => `A proposta "${p['titulo']}"`,
      acoes: [
        {
          icone: 'list_alt',
          rotulo: 'Itens',
          sucesso: 'Itens salvos.',
          executar: (p) =>
            editarItens(ctx, 'proposta_itens', 'proposta_id', p, `Itens · ${p['titulo']}`, ['APROVADA', 'RECUSADA'].includes(p['status'])),
        },
        {
          icone: 'send',
          rotulo: 'Enviar link ao cliente',
          visivel: (p) => ['RASCUNHO', 'ENVIADA'].includes(p['status']),
          executar: (p) =>
            gerarLink(ctx, { tipo: 'PROPOSTA', entidade: 'propostas_comerciais', registro_id: p['id'], titulo: p['titulo'] }).pipe(
              switchMap(() =>
                p['status'] === 'RASCUNHO'
                  ? ctx.supabase.executar(() =>
                      ctx.supabase.cliente
                        .from('propostas_comerciais')
                        .update({ status: 'ENVIADA', enviada_em: new Date().toISOString() })
                        .eq('id', p['id']),
                    )
                  : of(null),
              ),
            ),
        },
        {
          icone: 'thumb_up',
          rotulo: 'Aprovar',
          visivel: (p) => ['RASCUNHO', 'ENVIADA'].includes(p['status']),
          sucesso: 'Proposta aprovada e pedido criado.',
          executar: (p) => ctx.supabase.rpc('aprovar_proposta', { p_id: p['id'] }),
        },
        {
          icone: 'thumb_down',
          rotulo: 'Recusar',
          visivel: (p) => ['RASCUNHO', 'ENVIADA'].includes(p['status']),
          executar: (p) =>
            ctx.dialogos.formulario(
              {
                titulo: `Recusar ${p['titulo']}`,
                campos: [{ chave: 'motivoRecusa', rotulo: 'Motivo', tipo: 'textarea', max: 300 }],
                textoSalvar: 'Recusar',
                salvar: (d) =>
                  ctx.supabase.executar(() =>
                    ctx.supabase.cliente
                      .from('propostas_comerciais')
                      .update({ status: 'RECUSADA', motivo_recusa: d['motivoRecusa'], decidida_em: new Date().toISOString() })
                      .eq('id', p['id'])
                      .select()
                      .single(),
                  ),
              },
              'Proposta recusada.',
            ),
        },
      ],
    },
  ],
});

export const pedidos: FabricaDeTela = (ctx) => ({
  abas: [
    {
      titulo: 'Pedidos de venda',
      subtitulo: 'Ao faturar, as parcelas entram em contas a receber e as comissões são apuradas.',
      rotuloNovo: 'Novo pedido',
      rotuloBusca: 'Buscar pelo número',
      tabela: 'pedidos_venda',
      selecao: '*, cliente:clientes(nome)',
      busca: ['numero'],
      entidade: 'pedidos_venda',
      colunas: [
        { chave: 'numero', rotulo: 'Pedido', valor: (p) => p['numero'], detalhe: (p) => p['cliente']?.['nome'] },
        { chave: 'dataPedido', rotulo: 'Data', valor: (p) => data(p['dataPedido']) },
        { chave: 'status', rotulo: 'Situação', valor: (p) => rotulo(STATUS_DO_PEDIDO, p['status']) },
        { chave: 'valorTotal', rotulo: 'Total', valor: (p) => moeda(p['valorTotal']) },
        { chave: 'responsavel', rotulo: 'Responsável', valor: (p) => ctx.nomeDoUsuario(p['responsavelId']) },
      ],
      campos: [
        { chave: 'clienteId', rotulo: 'Cliente', tipo: 'select', obrigatorio: true, meia: true, fonte: { tabela: 'clientes', filtro: { ativo: true } } },
        { chave: 'dataPedido', rotulo: 'Data do pedido', tipo: 'data', obrigatorio: true, meia: true },
        { chave: 'responsavelId', rotulo: 'Responsável', tipo: 'select', meia: true, fonte: { usuarios: true } },
        { chave: 'descontoGeral', rotulo: 'Desconto geral (R$)', tipo: 'numero', min: 0, meia: true },
        { chave: 'condicoesPagamento', rotulo: 'Condições de pagamento', max: 300 },
        { chave: 'observacoes', rotulo: 'Observações', tipo: 'textarea', max: 4000 },
      ],
      valoresPadrao: { dataPedido: hojeIso(), descontoGeral: 0, responsavelId: ctx.auth.usuario()?.id },
      antesDeSalvar: (d) => ({ ...d, descontoGeral: d['descontoGeral'] ?? 0 }),
      descrever: (p) => `O pedido ${p['numero'] ?? ''}`,
      acoes: [
        {
          icone: 'list_alt',
          rotulo: 'Itens',
          sucesso: 'Itens salvos.',
          executar: (p) => editarItens(ctx, 'pedido_venda_itens', 'pedido_id', p, `Itens do pedido ${p['numero'] ?? ''}`, p['status'] !== 'ABERTO'),
        },
        {
          icone: 'request_quote',
          rotulo: 'Faturar',
          visivel: (p) => p['status'] === 'ABERTO',
          executar: (p) =>
            ctx.opcoes
              .resolver([
                { chave: 'parcelas', rotulo: 'Parcelas', tipo: 'numero', obrigatorio: true, min: 1, max: 120, meia: true },
                { chave: 'primeiroVencimento', rotulo: 'Primeiro vencimento', tipo: 'data', obrigatorio: true, meia: true },
                { chave: 'formaPagamento', rotulo: 'Forma de pagamento', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(FORMAS_DE_PAGAMENTO) },
                CONTA_BANCARIA,
              ])
              .pipe(
                switchMap((campos) =>
                  ctx.dialogos.formulario(
                    {
                      titulo: `Faturar pedido ${p['numero'] ?? ''}`,
                      campos,
                      valores: { parcelas: 1, primeiroVencimento: hojeIso(), formaPagamento: 'PIX' },
                      textoSalvar: 'Faturar',
                      salvar: (d) =>
                        ctx.supabase.rpc('faturar_pedido', {
                          p_id: p['id'],
                          p_parcelas: d['parcelas'],
                          p_primeiro_vencimento: d['primeiroVencimento'],
                          p_forma_pagamento: d['formaPagamento'],
                          p_conta_bancaria_id: d['contaBancariaId'],
                        }),
                    },
                    'Pedido faturado; parcelas lançadas em contas a receber.',
                  ),
                ),
              ),
        },
        {
          icone: 'block',
          rotulo: 'Cancelar pedido',
          visivel: (p) => p['status'] === 'ABERTO',
          sucesso: 'Pedido cancelado.',
          executar: (p) =>
            ctx.supabase.executar(() => ctx.supabase.cliente.from('pedidos_venda').update({ status: 'CANCELADO' }).eq('id', p['id'])),
        },
      ],
    },
  ],
});

export const tabelasPreco: FabricaDeTela = (ctx) => ({
  abas: [
    {
      titulo: 'Tabelas de preço',
      subtitulo: 'Preços diferentes por canal, região ou cliente, com desconto máximo por produto.',
      rotuloNovo: 'Nova tabela',
      rotuloBusca: 'Buscar pelo nome',
      tabela: 'tabelas_preco',
      ordem: [{ coluna: 'nome' }],
      busca: ['nome'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'nome', rotulo: 'Tabela', valor: (t) => t['nome'], detalhe: (t) => t['descricao'] },
        { chave: 'moeda', rotulo: 'Moeda', valor: (t) => t['moeda'] },
        {
          chave: 'vigencia',
          rotulo: 'Vigência',
          valor: (t) => (t['vigenciaInicio'] || t['vigenciaFim'] ? `${data(t['vigenciaInicio']) ?? '…'} a ${data(t['vigenciaFim']) ?? '…'}` : 'Sempre'),
        },
        { chave: 'padrao', rotulo: 'Padrão', valor: (t) => (t['padrao'] ? 'Sim' : 'Não') },
      ],
      campos: [
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80, meia: true },
        { chave: 'moeda', rotulo: 'Moeda', obrigatorio: true, max: 3, meia: true },
        { chave: 'descricao', rotulo: 'Descrição', max: 300 },
        { chave: 'vigenciaInicio', rotulo: 'Vale a partir de', tipo: 'data', meia: true },
        { chave: 'vigenciaFim', rotulo: 'Vale até', tipo: 'data', meia: true },
        { chave: 'padrao', rotulo: 'Tabela padrão', tipo: 'toggle' },
        { chave: 'ativo', rotulo: 'Ativa', tipo: 'toggle' },
      ],
      valoresPadrao: { moeda: 'BRL', padrao: false, ativo: true },
      antesDeSalvar: (d) => ({ ...d, moeda: String(d['moeda']).toUpperCase() }),
      descrever: (t) => `A tabela "${t['nome']}"`,
      acoes: [
        {
          icone: 'sell',
          rotulo: 'Preços',
          sucesso: 'Preços salvos.',
          executar: (t) =>
            editarLinhas(ctx.dialog, {
              titulo: `Preços · ${t['nome']}`,
              tabela: 'tabela_preco_itens',
              chaveDoPai: 'tabela_id',
              paiId: t['id'],
              colunas: [
                {
                  chave: 'produtoId',
                  rotulo: 'Produto',
                  tipo: 'select',
                  obrigatorio: true,
                  peso: 3,
                  fonte: { tabela: 'produtos', filtro: { ativo: true } },
                  aoEscolher: (linha, opcao) => {
                    if (opcao?.dados && linha['preco'] == null) {
                      linha['preco'] = opcao.dados['preco'];
                    }
                  },
                },
                { chave: 'preco', rotulo: 'Preço', tipo: 'numero', obrigatorio: true },
                { chave: 'descontoMaximo', rotulo: 'Desconto máx. %', tipo: 'numero' },
              ],
              novaLinha: () => ({ descontoMaximo: 0 }),
              validar: (linhas) => {
                const ids = linhas.map((l) => l['produtoId']);
                return new Set(ids).size !== ids.length ? 'Cada produto pode aparecer uma vez só.' : null;
              },
            }),
        },
      ],
    },
  ],
});

function mudarComissao(ctx: ContextoTela, id: string, status: string) {
  return ctx.supabase.executar(() => ctx.supabase.cliente.from('comissoes_apuradas').update({ status }).eq('id', id));
}

export const comissoes: FabricaDeTela = (ctx) => ({
  abas: [
    {
      aba: 'Apuradas',
      titulo: 'Comissões apuradas',
      subtitulo: 'Calculadas ao faturar cada pedido, pelas regras cadastradas.',
      tabela: 'comissoes_apuradas',
      selecao: '*, pedido:pedidos_venda(numero)',
      ordem: [{ coluna: 'competencia', crescente: false }, { coluna: 'criado_em', crescente: false }],
      podeExcluir: false,
      colunas: [
        { chave: 'usuario', rotulo: 'Vendedor', valor: (c) => ctx.nomeDoUsuario(c['usuarioId']), detalhe: (c) => `Pedido ${c['pedido']?.['numero'] ?? ''}` },
        { chave: 'competencia', rotulo: 'Mês', valor: (c) => data(c['competencia'])?.slice(3) },
        { chave: 'base', rotulo: 'Base', valor: (c) => moeda(c['valorBase']), detalhe: (c) => percentual(c['percentual']) },
        { chave: 'valor', rotulo: 'Comissão', valor: (c) => moeda(c['valorComissao']) },
        { chave: 'status', rotulo: 'Situação', valor: (c) => rotulo(STATUS_DA_COMISSAO, c['status']) },
      ],
      acoes: [
        { icone: 'check', rotulo: 'Aprovar', visivel: (c) => c['status'] === 'PENDENTE', sucesso: 'Comissão aprovada.', executar: (c) => mudarComissao(ctx, c['id'], 'APROVADA') },
        { icone: 'paid', rotulo: 'Marcar como paga', visivel: (c) => c['status'] === 'APROVADA', sucesso: 'Comissão paga.', executar: (c) => mudarComissao(ctx, c['id'], 'PAGA') },
        {
          icone: 'block',
          rotulo: 'Cancelar',
          visivel: (c) => ['PENDENTE', 'APROVADA'].includes(c['status']),
          sucesso: 'Comissão cancelada.',
          executar: (c) => mudarComissao(ctx, c['id'], 'CANCELADA'),
        },
      ],
    },
    {
      aba: 'Regras',
      titulo: 'Regras de comissão',
      subtitulo: 'Vale a regra ativa de maior prioridade que combinar com o vendedor e a categoria do produto.',
      rotuloNovo: 'Nova regra',
      rotuloBusca: 'Buscar pelo nome',
      tabela: 'regras_comissao',
      ordem: [{ coluna: 'prioridade', crescente: false }, { coluna: 'nome' }],
      busca: ['nome', 'categoria'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'nome', rotulo: 'Regra', valor: (r) => r['nome'], detalhe: (r) => r['categoria'] && `Categoria ${r['categoria']}` },
        { chave: 'percentual', rotulo: 'Percentual', valor: (r) => percentual(r['percentual']) },
        { chave: 'usuario', rotulo: 'Vendedor', valor: (r) => ctx.nomeDoUsuario(r['usuarioId']) ?? 'Todos' },
        { chave: 'prioridade', rotulo: 'Prioridade', valor: (r) => r['prioridade'] },
      ],
      campos: [
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80, meia: true },
        { chave: 'percentual', rotulo: 'Percentual (%)', tipo: 'numero', obrigatorio: true, min: 0, max: 100, meia: true },
        { chave: 'usuarioId', rotulo: 'Vendedor (vazio = todos)', tipo: 'select', meia: true, fonte: { usuarios: true } },
        { chave: 'categoria', rotulo: 'Categoria de produto', max: 60, meia: true },
        { chave: 'prioridade', rotulo: 'Prioridade', tipo: 'numero', meia: true },
        { chave: 'vigenciaInicio', rotulo: 'Vale a partir de', tipo: 'data', meia: true },
        { chave: 'vigenciaFim', rotulo: 'Vale até', tipo: 'data', meia: true },
        { chave: 'ativo', rotulo: 'Ativa', tipo: 'toggle' },
      ],
      valoresPadrao: { prioridade: 0, ativo: true },
      antesDeSalvar: (d) => ({ ...d, prioridade: d['prioridade'] ?? 0 }),
      descrever: (r) => `A regra "${r['nome']}"`,
    },
  ],
});

export const metas: FabricaDeTela = (ctx) => ({
  abas: [
    {
      tipo: 'componente',
      aba: 'Ranking',
      componente: () => import('../componentes/ranking-comercial').then((m) => m.RankingComercial),
    },
    {
      aba: 'Metas',
      titulo: 'Metas comerciais',
      subtitulo: 'Meta mensal de faturamento por vendedor (ou da equipe, sem vendedor).',
      rotuloNovo: 'Nova meta',
      tabela: 'metas_comerciais',
      ordem: [{ coluna: 'periodo', crescente: false }],
      colunas: [
        { chave: 'periodo', rotulo: 'Mês', valor: (m) => data(m['periodo'])?.slice(3) },
        { chave: 'usuario', rotulo: 'Vendedor', valor: (m) => ctx.nomeDoUsuario(m['usuarioId']) ?? 'Equipe' },
        { chave: 'valorMeta', rotulo: 'Meta', valor: (m) => moeda(m['valorMeta']) },
        { chave: 'quantidadeMeta', rotulo: 'Pedidos', valor: (m) => m['quantidadeMeta'] },
      ],
      campos: [
        { chave: 'periodo', rotulo: 'Mês (qualquer dia)', tipo: 'data', obrigatorio: true, meia: true },
        { chave: 'usuarioId', rotulo: 'Vendedor (vazio = equipe)', tipo: 'select', meia: true, fonte: { usuarios: true } },
        { chave: 'valorMeta', rotulo: 'Meta de faturamento (R$)', tipo: 'numero', obrigatorio: true, min: 0, meia: true },
        { chave: 'quantidadeMeta', rotulo: 'Meta de pedidos', tipo: 'numero', min: 0, meia: true },
      ],
      valoresPadrao: { periodo: inicioDoMes() },
      antesDeSalvar: (d) => ({ ...d, periodo: inicioDoMes(String(d['periodo'])) }),
      descrever: (m) => `A meta de ${data(m['periodo'])?.slice(3)}`,
    },
  ],
});