export type TipoCliente = 'PF' | 'PJ';
export type TipoEtapa = 'ABERTA' | 'GANHO' | 'PERDIDO';
export type TipoInteracao = 'LIGACAO' | 'EMAIL' | 'REUNIAO' | 'WHATSAPP' | 'NOTA';
export type StatusReclamacao = 'ABERTA' | 'EM_ANALISE' | 'RESOLVIDA' | 'ENCERRADA';
export type PrioridadeReclamacao = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type CanalReclamacao = 'TELEFONE' | 'EMAIL' | 'WHATSAPP' | 'PRESENCIAL' | 'SITE' | 'REDES_SOCIAIS';

export interface Cliente {
  id: string;
  tipo: TipoCliente;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  dataNascimento: string | null;
  cep: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  origem: string | null;
  responsavelId: string | null;
  observacoes: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  extras?: Record<string, unknown>;
}

export interface CrmEtapa {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  tipo: TipoEtapa;
  ativo: boolean;
}

export interface CrmOrigem {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface Lead {
  id: string;
  nome: string;
  empresa: string | null;
  email: string | null;
  telefone: string | null;
  origemId: string | null;
  etapaId: string;
  valorEstimado: number | null;
  responsavelId: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  motivoPerda: string | null;
  observacoes: string | null;
  ordem: number;
  clienteId: string | null;
  convertidoEm: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  extras?: Record<string, unknown>;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Interacao {
  id: string;
  leadId: string | null;
  clienteId: string | null;
  tipo: TipoInteracao;
  descricao: string;
  registradoPor: string | null;
  criadoEm: string;
}

export interface Reclamacao {
  id: string;
  protocolo: string;
  clienteId: string | null;
  cliente: { id: string; nome: string } | null;
  nomeContato: string | null;
  contato: string | null;
  assunto: string;
  descricao: string;
  canal: CanalReclamacao | null;
  prioridade: PrioridadeReclamacao;
  status: StatusReclamacao;
  responsavelId: string | null;
  prazo: string | null;
  solucao: string | null;
  resolvidaEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ReclamacaoEvento {
  id: string;
  reclamacaoId: string;
  tipo: 'CRIADA' | 'STATUS' | 'COMENTARIO';
  statusAnterior: StatusReclamacao | null;
  statusNovo: StatusReclamacao | null;
  comentario: string | null;
  autorId: string | null;
  criadoEm: string;
}

export const TIPOS_DE_INTERACAO: Record<TipoInteracao, { rotulo: string; icone: string }> = {
  LIGACAO: { rotulo: 'Ligação', icone: 'call' },
  EMAIL: { rotulo: 'E-mail', icone: 'mail' },
  REUNIAO: { rotulo: 'Reunião', icone: 'groups' },
  WHATSAPP: { rotulo: 'WhatsApp', icone: 'chat' },
  NOTA: { rotulo: 'Nota', icone: 'sticky_note_2' },
};

export const STATUS_DE_RECLAMACAO: { status: StatusReclamacao; rotulo: string; icone: string }[] = [
  { status: 'ABERTA', rotulo: 'Aberta', icone: 'report' },
  { status: 'EM_ANALISE', rotulo: 'Em análise', icone: 'manage_search' },
  { status: 'RESOLVIDA', rotulo: 'Resolvida', icone: 'task_alt' },
  { status: 'ENCERRADA', rotulo: 'Encerrada', icone: 'archive' },
];

export const ROTULO_DO_STATUS: Record<StatusReclamacao, string> = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em análise',
  RESOLVIDA: 'Resolvida',
  ENCERRADA: 'Encerrada',
};

export const PRIORIDADES: Record<PrioridadeReclamacao, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

export const CANAIS: Record<CanalReclamacao, string> = {
  TELEFONE: 'Telefone',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  PRESENCIAL: 'Presencial',
  SITE: 'Site',
  REDES_SOCIAIS: 'Redes sociais',
};

export const TIPOS_DE_ETAPA: Record<TipoEtapa, string> = {
  ABERTA: 'Em andamento',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
};

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

/**
 * Ordem de um card solto na posição `posicao` de uma coluna (que chega sem ele): o meio entre os vizinhos,
 * para não precisar renumerar os demais.
 */
export function ordemNaPosicao(coluna: { ordem: number }[], posicao: number): number {
  const anterior = coluna[posicao - 1]?.ordem;
  const proximo = coluna[posicao]?.ordem;
  if (anterior !== undefined && proximo !== undefined) {
    return (anterior + proximo) / 2;
  }
  if (anterior !== undefined) {
    return anterior + 1;
  }
  if (proximo !== undefined) {
    return proximo - 1;
  }
  return Date.now() / 1000;
}

/** Opções no formato dos campos de seleção do formulário genérico. */
export function opcoesDe<T extends string>(rotulos: Record<T, string>): { valor: T; rotulo: string }[] {
  return (Object.entries(rotulos) as [T, string][]).map(([valor, rotulo]) => ({ valor, rotulo }));
}
