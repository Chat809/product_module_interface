/** Caminho da API, que também identifica a aba. */
export type TipoConta = 'contas-pagar' | 'contas-receber';
export type StatusConta = 'PENDENTE' | 'PAGO' | 'RECEBIDO' | 'CANCELADO';
export type FormaPagamento = 'PIX' | 'BOLETO' | 'TRANSFERENCIA' | 'CARTAO' | 'DINHEIRO';

/** Espelha o ContaDTO da API. `pessoa` é o favorecido (a pagar) ou o pagador (a receber). */
export interface Conta {
  id: string;
  descricao: string;
  pessoa: string;
  documento: string | null;
  categoria: string | null;
  valor: number;
  percentualImposto: number;
  valorImposto: number;
  valorLiquido: number;
  vencimento: string;
  dataBaixa: string | null;
  status: StatusConta;
  vencida: boolean;
  formaPagamento: FormaPagamento;
  chavePix: string | null;
  observacoes: string | null;
  criadoPor: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  /** Fornecedor (a pagar) ou cliente (a receber) cadastrado. */
  vinculoId: string | null;
  centroCustoId: string | null;
  competencia?: string | null;
  contaBancariaId?: string | null;
  planoContaId?: string | null;
  recorrenciaId?: string | null;
  parcelamentoId?: string | null;
  parcelaNumero?: number | null;
  parcelaTotal?: number | null;
  juros?: number;
  multa?: number;
  desconto?: number;
  valorPago?: number | null;
  extras?: Record<string, unknown>;
}

export interface Fornecedor {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  documento: string | null;
  contato: string | null;
  email: string | null;
  telefone: string | null;
  chavePix: string | null;
  categoria: string | null;
  observacoes: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

/** CPF (11 dígitos) ou CNPJ (14) com a pontuação de costume. */
export function formatarDocumento(documento: string | null | undefined): string | null {
  if (!documento) {
    return null;
  }
  if (documento.length === 11) {
    return documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (documento.length === 14) {
    return documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return documento;
}

/** Espelha o ContaRequestDTO da API. */
export interface ContaRequest {
  descricao: string;
  pessoa: string;
  documento: string | null;
  categoria: string | null;
  valor: number;
  percentualImposto: number;
  vencimento: string;
  formaPagamento: FormaPagamento;
  chavePix: string | null;
  observacoes: string | null;
  vinculoId: string | null;
  centroCustoId: string | null;
  competencia?: string | null;
  contaBancariaId?: string | null;
  planoContaId?: string | null;
  extras?: Record<string, unknown>;
}

/** Espelha o ResumoFinanceiroDTO: totais pelo valor líquido. */
export interface ResumoFinanceiro {
  aPagar: number;
  aPagarVencido: number;
  contasAPagarVencidas: number;
  aReceber: number;
  aReceberVencido: number;
  contasAReceberVencidas: number;
  pagoNoMes: number;
  recebidoNoMes: number;
  saldoPrevisto: number;
}

/** "Vencidas" não é um status gravado: são as pendentes com vencimento antes de hoje. */
export type FiltroSituacaoConta = 'PENDENTE' | 'VENCIDAS' | 'QUITADA' | 'CANCELADO' | 'TODAS';

export interface FiltroContas {
  situacao: FiltroSituacaoConta;
  busca: string;
  vencimentoDe: string;
  vencimentoAte: string;
}

export interface DadosDoTipo {
  titulo: string;
  pessoa: string;
  dicaPessoa: string;
  quitado: Extract<StatusConta, 'PAGO' | 'RECEBIDO'>;
  rotuloQuitado: string;
  acaoBaixa: string;
  rotuloData: string;
}

export const TIPOS_DE_CONTA: Record<TipoConta, DadosDoTipo> = {
  'contas-pagar': {
    titulo: 'Contas a pagar',
    pessoa: 'Favorecido',
    dicaPessoa: 'A quem será pago',
    quitado: 'PAGO',
    rotuloQuitado: 'Paga',
    acaoBaixa: 'Registrar pagamento',
    rotuloData: 'Data do pagamento',
  },
  'contas-receber': {
    titulo: 'Contas a receber',
    pessoa: 'Pagador',
    dicaPessoa: 'Quem vai pagar',
    quitado: 'RECEBIDO',
    rotuloQuitado: 'Recebida',
    acaoBaixa: 'Registrar recebimento',
    rotuloData: 'Data do recebimento',
  },
};

export const FORMAS_DE_PAGAMENTO: Record<FormaPagamento, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  TRANSFERENCIA: 'Transferência',
  CARTAO: 'Cartão',
  DINHEIRO: 'Dinheiro',
};

/** Mesma conta do banco (coluna gerada): imposto arredondado em centavos e líquido = valor - imposto. */
export function calcularImposto(valor: number, percentual: number): { imposto: number; liquido: number } {
  const centavos = Math.round(valor * 100);
  const impostoEmCentavos = Math.round((centavos * Math.round(percentual * 100)) / 10000);
  return { imposto: impostoEmCentavos / 100, liquido: (centavos - impostoEmCentavos) / 100 };
}

/** Data de hoje no fuso do navegador, no formato aaaa-mm-dd usado pela API. */
export function hojeIso(agora = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}
