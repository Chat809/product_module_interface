import { switchMap } from 'rxjs';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { data, hojeIso, moeda, numero, opcoes, rotulo } from '../formatos';
import { CampoTela, FabricaDeTela, Registro } from '../tela.model';

export const TIPOS_DE_CONTA_BANCARIA: Record<string, string> = {
  CORRENTE: 'Conta corrente',
  POUPANCA: 'Poupança',
  CAIXA: 'Caixa físico',
  CARTEIRA_DIGITAL: 'Carteira digital',
  INVESTIMENTO: 'Investimento',
};
const NATUREZAS: Record<string, string> = { RECEITA: 'Receita', DESPESA: 'Despesa' };
const GRUPOS_DRE: Record<string, string> = {
  RECEITA_BRUTA: 'Receita bruta',
  DEDUCOES: 'Deduções',
  CUSTOS: 'Custos',
  DESPESAS_OPERACIONAIS: 'Despesas operacionais',
  RECEITAS_FINANCEIRAS: 'Receitas financeiras',
  DESPESAS_FINANCEIRAS: 'Despesas financeiras',
  IMPOSTOS_SOBRE_LUCRO: 'Impostos sobre o lucro',
};
const STATUS_DA_FATURA: Record<string, string> = { ABERTA: 'Aberta', FECHADA: 'Fechada', PAGA: 'Paga' };
const TIPOS_DE_LANCAMENTO: Record<string, string> = { ENTRADA: 'Entrada', SAIDA: 'Saída' };
const ORIGENS_DE_LANCAMENTO: Record<string, string> = {
  MANUAL: 'Manual',
  CONTA_PAGAR: 'Conta paga',
  CONTA_RECEBER: 'Conta recebida',
  TRANSFERENCIA: 'Transferência',
};
export const FORMAS_DE_PAGAMENTO: Record<string, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  TRANSFERENCIA: 'Transferência',
  CARTAO: 'Cartão',
  DINHEIRO: 'Dinheiro',
};
export const FREQUENCIAS: Record<string, string> = {
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

export const CONTA_BANCARIA: CampoTela = {
  chave: 'contaBancariaId',
  rotulo: 'Conta bancária',
  tipo: 'select',
  meia: true,
  fonte: { tabela: 'contas_bancarias', filtro: { ativo: true } },
};
export const PLANO_DE_CONTAS: CampoTela = {
  chave: 'planoContaId',
  rotulo: 'Plano de contas',
  tipo: 'select',
  meia: true,
  fonte: { tabela: 'plano_contas', detalhe: 'codigo', filtro: { ativo: true, aceita_lancamento: true }, ordem: 'codigo' },
};
export const CENTRO_DE_CUSTO: CampoTela = {
  chave: 'centroCustoId',
  rotulo: 'Centro de custo',
  tipo: 'select',
  meia: true,
  fonte: { tabela: 'centros_custo', filtro: { ativo: true } },
};
const CARTAO: CampoTela = {
  chave: 'cartaoId',
  rotulo: 'Cartão',
  tipo: 'select',
  obrigatorio: true,
  meia: true,
  fonte: { tabela: 'cartoes_corporativos', filtro: { ativo: true } },
};

const CAMPOS_DE_GASTO: CampoTela[] = [
  { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true, meia: true },
  { chave: 'valor', rotulo: 'Valor (R$)', tipo: 'numero', obrigatorio: true, min: 0.01, meia: true },
  { chave: 'descricao', rotulo: 'Descrição', obrigatorio: true, max: 150 },
  PLANO_DE_CONTAS,
  CENTRO_DE_CUSTO,
  { chave: 'portadorId', rotulo: 'Quem usou', tipo: 'select', meia: true, fonte: { usuarios: true } },
];

export const contasBancarias: FabricaDeTela = (ctx) => ({
  abas: [
    {
      titulo: 'Contas bancárias',
      subtitulo: 'Bancos, caixa e carteiras. O saldo soma os lançamentos a partir da data do saldo inicial.',
      rotuloNovo: 'Nova conta',
      rotuloBusca: 'Buscar por nome',
      tabela: 'contas_bancarias',
      tabelaDeLista: 'saldos_contas_bancarias',
      ordem: [{ coluna: 'nome' }],
      busca: ['nome'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'nome', rotulo: 'Conta', valor: (c) => c['nome'], detalhe: (c) => rotulo(TIPOS_DE_CONTA_BANCARIA, c['tipo']) },
        { chave: 'saldoAtual', rotulo: 'Saldo atual', valor: (c) => moeda(c['saldoAtual'], c['moeda']) },
        { chave: 'saldoConciliado', rotulo: 'Saldo conciliado', valor: (c) => moeda(c['saldoConciliado'], c['moeda']) },
      ],
      campos: [
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80, meia: true },
        { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(TIPOS_DE_CONTA_BANCARIA) },
        { chave: 'banco', rotulo: 'Banco', max: 80, meia: true },
        { chave: 'agencia', rotulo: 'Agência', max: 20, meia: true },
        { chave: 'numero', rotulo: 'Número da conta', max: 30, meia: true },
        { chave: 'moeda', rotulo: 'Moeda', obrigatorio: true, max: 3, meia: true, padrao: /^\s*[A-Za-z]{3}\s*$/, mensagemPadrao: 'Código de 3 letras, ex.: BRL' },
        { chave: 'saldoInicial', rotulo: 'Saldo inicial', tipo: 'numero', obrigatorio: true, meia: true },
        { chave: 'dataSaldoInicial', rotulo: 'Data do saldo inicial', tipo: 'data', obrigatorio: true, meia: true },
        { chave: 'ativo', rotulo: 'Ativa', tipo: 'toggle' },
      ],
      valoresPadrao: { tipo: 'CORRENTE', moeda: 'BRL', saldoInicial: 0, dataSaldoInicial: hojeIso(), ativo: true },
      antesDeSalvar: (d) => ({ ...d, moeda: String(d['moeda']).toUpperCase() }),
      descrever: (c) => `A conta "${c['nome']}"`,
      acoesDaPagina: [
        {
          icone: 'swap_horiz',
          rotulo: 'Transferir',
          sucesso: 'Transferência registrada.',
          executar: () =>
            ctx.opcoes
              .resolver([
                { ...CONTA_BANCARIA, chave: 'origem', rotulo: 'De', obrigatorio: true },
                { ...CONTA_BANCARIA, chave: 'destino', rotulo: 'Para', obrigatorio: true },
                { chave: 'valor', rotulo: 'Valor', tipo: 'numero', obrigatorio: true, min: 0.01, meia: true },
                { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true, meia: true },
                { chave: 'descricao', rotulo: 'Descrição', max: 150 },
              ])
              .pipe(
                switchMap((campos) =>
                  ctx.dialogos.formulario(
                    {
                      titulo: 'Transferir entre contas',
                      campos,
                      valores: { data: hojeIso() },
                      textoSalvar: 'Transferir',
                      salvar: (d) =>
                        ctx.supabase.rpc('transferir_entre_contas', {
                          p_origem: d['origem'],
                          p_destino: d['destino'],
                          p_valor: d['valor'],
                          p_data: d['data'],
                          p_descricao: d['descricao'] ?? 'Transferência entre contas',
                        }),
                    },
                    'Transferência registrada.',
                  ),
                ),
              ),
        },
      ],
    },
  ],
});

export const planoContas: FabricaDeTela = () => ({
  abas: [
    {
      titulo: 'Plano de contas',
      subtitulo: 'Classificação de receitas e despesas usada nos lançamentos e no DRE.',
      rotuloNovo: 'Nova conta contábil',
      rotuloBusca: 'Buscar por código ou nome',
      tabela: 'plano_contas',
      ordem: [{ coluna: 'codigo' }],
      busca: ['codigo', 'nome'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'codigo', rotulo: 'Código', valor: (p) => p['codigo'] },
        { chave: 'nome', rotulo: 'Nome', valor: (p) => p['nome'], detalhe: (p) => rotulo(GRUPOS_DRE, p['grupoDre']) },
        { chave: 'natureza', rotulo: 'Natureza', valor: (p) => rotulo(NATUREZAS, p['natureza']) },
        { chave: 'aceita', rotulo: 'Recebe lançamentos', valor: (p) => (p['aceitaLancamento'] ? 'Sim' : 'Não (agrupadora)') },
      ],
      campos: [
        { chave: 'codigo', rotulo: 'Código', obrigatorio: true, max: 20, meia: true, dica: 'Ex.: 3.1.02' },
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 100, meia: true },
        { chave: 'natureza', rotulo: 'Natureza', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(NATUREZAS) },
        { chave: 'grupoDre', rotulo: 'Grupo no DRE', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(GRUPOS_DRE) },
        { chave: 'paiId', rotulo: 'Conta agrupadora', tipo: 'select', fonte: { tabela: 'plano_contas', detalhe: 'codigo', ordem: 'codigo' } },
        { chave: 'aceitaLancamento', rotulo: 'Recebe lançamentos', tipo: 'toggle' },
        { chave: 'ativo', rotulo: 'Ativa', tipo: 'toggle' },
      ],
      valoresPadrao: { natureza: 'DESPESA', grupoDre: 'DESPESAS_OPERACIONAIS', aceitaLancamento: true, ativo: true },
      descrever: (p) => `A conta "${p['codigo']} · ${p['nome']}"`,
    },
  ],
});

export const cartoes: FabricaDeTela = (ctx) => ({
  abas: [
    {
      aba: 'Cartões',
      titulo: 'Cartões corporativos',
      subtitulo: 'Os gastos entram na fatura do mês; ao fechar, a fatura vira uma conta a pagar.',
      rotuloNovo: 'Novo cartão',
      rotuloBusca: 'Buscar por nome',
      tabela: 'cartoes_corporativos',
      selecao: '*, conta:contas_bancarias(nome)',
      ordem: [{ coluna: 'nome' }],
      busca: ['nome', 'bandeira'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'nome', rotulo: 'Cartão', valor: (c) => c['nome'], detalhe: (c) => [c['bandeira'], c['final'] && `final ${c['final']}`].filter(Boolean).join(' · ') },
        { chave: 'limite', rotulo: 'Limite', valor: (c) => moeda(c['limite']) },
        { chave: 'ciclo', rotulo: 'Ciclo', valor: (c) => `Fecha dia ${c['diaFechamento']} · vence dia ${c['diaVencimento']}` },
        { chave: 'responsavel', rotulo: 'Responsável', valor: (c) => ctx.nomeDoUsuario(c['responsavelId']) },
      ],
      campos: [
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80, meia: true },
        { chave: 'bandeira', rotulo: 'Bandeira', max: 30, meia: true },
        { chave: 'final', rotulo: 'Últimos 4 dígitos', max: 4, meia: true, padrao: /^\s*\d{4}\s*$/, mensagemPadrao: 'Informe 4 dígitos' },
        { chave: 'limite', rotulo: 'Limite (R$)', tipo: 'numero', min: 0, meia: true },
        { chave: 'diaFechamento', rotulo: 'Dia do fechamento', tipo: 'numero', obrigatorio: true, min: 1, max: 28, meia: true },
        { chave: 'diaVencimento', rotulo: 'Dia do vencimento', tipo: 'numero', obrigatorio: true, min: 1, max: 28, meia: true },
        { chave: 'responsavelId', rotulo: 'Responsável', tipo: 'select', meia: true, fonte: { usuarios: true } },
        { ...CONTA_BANCARIA, rotulo: 'Conta que paga a fatura' },
        { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle' },
      ],
      valoresPadrao: { diaFechamento: 1, diaVencimento: 10, ativo: true },
      descrever: (c) => `O cartão "${c['nome']}"`,
      acoes: [
        {
          icone: 'add_shopping_cart',
          rotulo: 'Lançar gasto',
          sucesso: 'Gasto lançado.',
          executar: (cartao) =>
            ctx.opcoes.resolver(CAMPOS_DE_GASTO).pipe(
              switchMap((campos) =>
                ctx.dialogos.formulario(
                  {
                    titulo: `Gasto no ${cartao['nome']}`,
                    campos,
                    valores: { data: hojeIso() },
                    salvar: (d) =>
                      ctx.supabase.executar(() =>
                        ctx.supabase.cliente.from('gastos_cartao').insert(ctx.supabase.paraSnake({ ...d, cartaoId: cartao['id'] })).select().single(),
                      ),
                  },
                  'Gasto lançado.',
                ),
              ),
            ),
        },
      ],
    },
    {
      aba: 'Gastos',
      titulo: 'Gastos nos cartões',
      rotuloNovo: 'Novo gasto',
      rotuloBusca: 'Buscar pela descrição',
      tabela: 'gastos_cartao',
      selecao: '*, cartao:cartoes_corporativos(nome), fatura:faturas_cartao_corporativo(competencia, status)',
      ordem: [{ coluna: 'data', crescente: false }, { coluna: 'criado_em', crescente: false }],
      busca: ['descricao'],
      colunas: [
        { chave: 'data', rotulo: 'Data', valor: (g) => data(g['data']) },
        { chave: 'descricao', rotulo: 'Descrição', valor: (g) => g['descricao'], detalhe: (g) => g['cartao']?.['nome'] },
        { chave: 'valor', rotulo: 'Valor', valor: (g) => moeda(g['valor']) },
        {
          chave: 'fatura',
          rotulo: 'Fatura',
          valor: (g) => (g['fatura'] ? `${data(g['fatura']['competencia'])?.slice(3)} · ${rotulo(STATUS_DA_FATURA, g['fatura']['status'])}` : null),
        },
      ],
      campos: [CARTAO, ...CAMPOS_DE_GASTO],
      valoresPadrao: { data: hojeIso() },
      descrever: (g) => `O gasto "${g['descricao']}"`,
    },
    {
      aba: 'Faturas',
      titulo: 'Faturas',
      subtitulo: 'Feche a fatura para gerar a conta a pagar com o total do mês.',
      tabela: 'faturas_cartao_corporativo',
      selecao: '*, cartao:cartoes_corporativos(nome)',
      ordem: [{ coluna: 'competencia', crescente: false }],
      podeExcluir: false,
      colunas: [
        { chave: 'cartao', rotulo: 'Cartão', valor: (f) => f['cartao']?.['nome'] },
        { chave: 'competencia', rotulo: 'Mês', valor: (f) => data(f['competencia'])?.slice(3) },
        { chave: 'vencimento', rotulo: 'Vencimento', valor: (f) => data(f['vencimento']), detalhe: (f) => `Fecha em ${data(f['fechamento'])}` },
        { chave: 'valorTotal', rotulo: 'Total', valor: (f) => moeda(f['valorTotal']) },
        { chave: 'status', rotulo: 'Situação', valor: (f) => rotulo(STATUS_DA_FATURA, f['status']) },
      ],
      acoes: [
        {
          icone: 'lock',
          rotulo: 'Fechar fatura',
          visivel: (f) => f['status'] === 'ABERTA',
          sucesso: 'Fatura fechada e lançada em contas a pagar.',
          executar: (f) => ctx.supabase.rpc('fechar_fatura', { p_fatura_id: f['id'] }),
        },
      ],
    },
  ],
});

export const creditos: FabricaDeTela = () => ({
  abas: [
    {
      aba: 'Saldos',
      titulo: 'Créditos de clientes',
      subtitulo: 'Saldo de cada cliente, atualizado a cada crédito ou débito.',
      tabela: 'creditos_cliente',
      chave: 'cliente_id',
      selecao: '*, cliente:clientes(nome)',
      ordem: [{ coluna: 'atualizado_em', crescente: false }],
      podeExcluir: false,
      vazio: 'Nenhum cliente com crédito.',
      colunas: [
        { chave: 'cliente', rotulo: 'Cliente', valor: (c) => c['cliente']?.['nome'] },
        { chave: 'saldo', rotulo: 'Saldo', valor: (c) => moeda(c['saldo']) },
        { chave: 'atualizadoEm', rotulo: 'Última movimentação', valor: (c) => data(c['atualizadoEm']) },
      ],
    },
    {
      aba: 'Movimentos',
      titulo: 'Movimentos de crédito',
      subtitulo: 'Créditos dados (devolução, bônus) e débitos usados. Movimentos não se editam: lance o contrário para corrigir.',
      rotuloNovo: 'Novo movimento',
      rotuloBusca: 'Buscar pelo motivo',
      tabela: 'creditos_cliente_movimentos',
      selecao: '*, cliente:clientes(nome)',
      busca: ['motivo'],
      podeEditar: false,
      podeExcluir: false,
      colunas: [
        { chave: 'criadoEm', rotulo: 'Data', valor: (m) => data(m['criadoEm']) },
        { chave: 'cliente', rotulo: 'Cliente', valor: (m) => m['cliente']?.['nome'], detalhe: (m) => m['motivo'] },
        { chave: 'tipo', rotulo: 'Tipo', valor: (m) => (m['tipo'] === 'CREDITO' ? 'Crédito' : 'Débito') },
        { chave: 'valor', rotulo: 'Valor', valor: (m) => moeda(m['valor']) },
        { chave: 'validade', rotulo: 'Validade', valor: (m) => data(m['validade']) },
      ],
      campos: [
        { chave: 'clienteId', rotulo: 'Cliente', tipo: 'select', obrigatorio: true, fonte: { tabela: 'clientes', filtro: { ativo: true } } },
        { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes({ CREDITO: 'Crédito', DEBITO: 'Débito' }) },
        { chave: 'valor', rotulo: 'Valor (R$)', tipo: 'numero', obrigatorio: true, min: 0.01, meia: true },
        { chave: 'motivo', rotulo: 'Motivo', obrigatorio: true, max: 200 },
        { chave: 'validade', rotulo: 'Validade do crédito', tipo: 'data', meia: true },
      ],
      valoresPadrao: { tipo: 'CREDITO' },
      mensagens: { criado: 'Movimento registrado.' },
    },
  ],
});

export const cotacoes: FabricaDeTela = () => ({
  abas: [
    {
      titulo: 'Cotações de moeda',
      subtitulo: 'Valor de cada moeda em reais, por dia, para contas e tabelas em moeda estrangeira.',
      rotuloNovo: 'Nova cotação',
      rotuloBusca: 'Buscar pela moeda',
      tabela: 'cotacoes_moeda',
      ordem: [{ coluna: 'data', crescente: false }, { coluna: 'moeda' }],
      busca: ['moeda', 'fonte'],
      colunas: [
        { chave: 'moeda', rotulo: 'Moeda', valor: (c) => c['moeda'] },
        { chave: 'data', rotulo: 'Data', valor: (c) => data(c['data']) },
        { chave: 'valor', rotulo: 'Valor em R$', valor: (c) => numero(c['valor']) },
        { chave: 'fonte', rotulo: 'Fonte', valor: (c) => c['fonte'] },
      ],
      campos: [
        { chave: 'moeda', rotulo: 'Moeda', obrigatorio: true, max: 3, meia: true, padrao: /^\s*[A-Za-z]{3}\s*$/, mensagemPadrao: 'Código de 3 letras, ex.: USD' },
        { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true, meia: true },
        { chave: 'valor', rotulo: 'Valor em R$', tipo: 'numero', obrigatorio: true, min: 0.000001, meia: true },
        { chave: 'fonte', rotulo: 'Fonte', max: 80, meia: true },
      ],
      valoresPadrao: { data: hojeIso() },
      antesDeSalvar: (d) => ({ ...d, moeda: String(d['moeda']).toUpperCase() }),
      descrever: (c) => `A cotação de ${c['moeda']} em ${data(c['data'])}`,
    },
  ],
});

/** Abas de lançamentos e recorrências da tela de fluxo de caixa (o gráfico é um componente à parte). */
export const fluxoCaixa: FabricaDeTela = (ctx) => ({
  abas: [
    {
      tipo: 'componente',
      aba: 'Projeção',
      componente: () => import('../componentes/fluxo-caixa').then((m) => m.FluxoCaixa),
    },
    {
      aba: 'Lançamentos',
      titulo: 'Lançamentos de caixa',
      subtitulo: 'Pagamentos e recebimentos baixados entram aqui sozinhos. Concilie conferindo com o extrato do banco.',
      rotuloNovo: 'Lançamento manual',
      rotuloBusca: 'Buscar pela descrição',
      tabela: 'lancamentos_caixa',
      selecao: '*, conta:contas_bancarias(nome)',
      ordem: [{ coluna: 'data', crescente: false }, { coluna: 'criado_em', crescente: false }],
      busca: ['descricao'],
      colunas: [
        { chave: 'data', rotulo: 'Data', valor: (l) => data(l['data']) },
        { chave: 'descricao', rotulo: 'Descrição', valor: (l) => l['descricao'], detalhe: (l) => `${l['conta']?.['nome'] ?? ''} · ${rotulo(ORIGENS_DE_LANCAMENTO, l['origem'])}` },
        { chave: 'valor', rotulo: 'Valor', valor: (l) => moeda(l['tipo'] === 'SAIDA' ? -l['valor'] : l['valor']) },
        { chave: 'conciliado', rotulo: 'Conciliado', valor: (l) => (l['conciliado'] ? 'Sim' : 'Não') },
      ],
      campos: [
        { ...CONTA_BANCARIA, obrigatorio: true },
        { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(TIPOS_DE_LANCAMENTO) },
        { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true, meia: true },
        { chave: 'valor', rotulo: 'Valor (R$)', tipo: 'numero', obrigatorio: true, min: 0.01, meia: true },
        { chave: 'descricao', rotulo: 'Descrição', obrigatorio: true, max: 150 },
        PLANO_DE_CONTAS,
      ],
      valoresPadrao: { tipo: 'SAIDA', data: hojeIso() },
      descrever: (l) => `O lançamento "${l['descricao']}"`,
      acoes: [
        {
          icone: 'task_alt',
          rotulo: 'Conciliar',
          visivel: (l) => !l['conciliado'],
          sucesso: 'Lançamento conciliado.',
          executar: (l) => conciliar(ctx.supabase, l, true),
        },
        {
          icone: 'remove_done',
          rotulo: 'Desfazer conciliação',
          visivel: (l) => !!l['conciliado'],
          sucesso: 'Conciliação desfeita.',
          executar: (l) => conciliar(ctx.supabase, l, false),
        },
      ],
    },
    {
      aba: 'Recorrências',
      titulo: 'Contas recorrentes',
      subtitulo: 'Aluguel, assinaturas, mensalidades: as contas são geradas sozinhas alguns dias antes do vencimento.',
      rotuloNovo: 'Nova recorrência',
      rotuloBusca: 'Buscar pela descrição ou pessoa',
      tabela: 'recorrencias_financeiras',
      ordem: [{ coluna: 'proxima_geracao' }],
      busca: ['descricao', 'pessoa'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'descricao', rotulo: 'Descrição', valor: (r) => r['descricao'], detalhe: (r) => r['pessoa'] },
        { chave: 'tipo', rotulo: 'Tipo', valor: (r) => (r['tipo'] === 'PAGAR' ? 'A pagar' : 'A receber') },
        { chave: 'valor', rotulo: 'Valor', valor: (r) => moeda(r['valor']), detalhe: (r) => rotulo(FREQUENCIAS, r['frequencia']) },
        { chave: 'proximaGeracao', rotulo: 'Próximo vencimento', valor: (r) => data(r['proximaGeracao']) },
      ],
      campos: CAMPOS_DE_RECORRENCIA,
      valoresPadrao: { tipo: 'PAGAR', frequencia: 'MENSAL', formaPagamento: 'BOLETO', antecedenciaDias: 10, inicio: hojeIso(), ativo: true },
      antesDeSalvar: (d, r) => ({ ...d, proximaGeracao: d['proximaGeracao'] ?? r?.['proximaGeracao'] ?? d['inicio'] }),
      descrever: (r) => `A recorrência "${r['descricao']}" (as contas já geradas continuam)`,
      acoes: [
        {
          icone: 'play_circle',
          rotulo: 'Gerar contas agora',
          sucesso: 'Contas geradas até a antecedência configurada.',
          executar: (r) => ctx.supabase.rpc('processar_recorrencia', { p_id: r['id'] }),
        },
      ],
    },
  ],
});

export const CAMPOS_DE_RECORRENCIA: CampoTela[] = [
  { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes({ PAGAR: 'A pagar', RECEBER: 'A receber' }) },
  { chave: 'frequencia', rotulo: 'Frequência', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(FREQUENCIAS) },
  { chave: 'descricao', rotulo: 'Descrição', obrigatorio: true, max: 150, meia: true },
  { chave: 'pessoa', rotulo: 'Favorecido ou pagador', obrigatorio: true, max: 150, meia: true },
  { chave: 'valor', rotulo: 'Valor (R$)', tipo: 'numero', obrigatorio: true, min: 0.01, meia: true },
  { chave: 'formaPagamento', rotulo: 'Forma de pagamento', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(FORMAS_DE_PAGAMENTO) },
  { chave: 'inicio', rotulo: 'Primeiro vencimento', tipo: 'data', obrigatorio: true, meia: true },
  { chave: 'fim', rotulo: 'Último vencimento', tipo: 'data', meia: true },
  { chave: 'proximaGeracao', rotulo: 'Próximo vencimento a gerar', tipo: 'data', meia: true, dica: 'Vazio usa o primeiro vencimento' },
  { chave: 'antecedenciaDias', rotulo: 'Gerar com quantos dias de antecedência', tipo: 'numero', min: 0, max: 90, meia: true },
  { chave: 'chavePix', rotulo: 'Chave Pix', max: 140, meia: true },
  { chave: 'categoria', rotulo: 'Categoria', max: 60, meia: true },
  { chave: 'fornecedorId', rotulo: 'Fornecedor', tipo: 'select', meia: true, fonte: { tabela: 'fornecedores', rotulo: 'razao_social', filtro: { ativo: true } } },
  { chave: 'clienteId', rotulo: 'Cliente', tipo: 'select', meia: true, fonte: { tabela: 'clientes', filtro: { ativo: true } } },
  CENTRO_DE_CUSTO,
  PLANO_DE_CONTAS,
  CONTA_BANCARIA,
  { chave: 'ativo', rotulo: 'Ativa', tipo: 'toggle' },
];

function conciliar(supabase: SupabaseService, lancamento: Registro, conciliado: boolean) {
  return supabase.executar(() =>
    supabase.cliente
      .from('lancamentos_caixa')
      .update({ conciliado, conciliado_em: conciliado ? new Date().toISOString() : null })
      .eq('id', lancamento['id']),
  );
}
