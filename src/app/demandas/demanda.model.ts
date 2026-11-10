export type StatusDemanda = 'A_FAZER' | 'EM_ANDAMENTO' | 'EM_REVISAO' | 'CONCLUIDO';
export type UrgenciaDemanda = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type TipoDemanda = 'TAREFA' | 'BUG' | 'MELHORIA' | 'SOLICITACAO';

export interface ItemChecklist {
  texto: string;
  feito: boolean;
}

/** Espelha o DemandaDTO da API. */
export interface Demanda {
  id: string;
  titulo: string;
  descricao: string | null;
  status: StatusDemanda;
  urgencia: UrgenciaDemanda;
  tipo: TipoDemanda;
  prazo: string | null;
  atrasada: boolean;
  responsaveis: string[];
  checklist: ItemChecklist[];
  ordem: number;
  criadoPor: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  quadroId?: string | null;
  colunaId?: string | null;
  extras?: Record<string, unknown>;
}

/** Espelha o DemandaRequestDTO da API. */
export interface DemandaRequest {
  titulo: string;
  descricao: string | null;
  tipo: TipoDemanda;
  urgencia: UrgenciaDemanda;
  status: StatusDemanda;
  prazo: string | null;
  responsaveis: string[];
  checklist: ItemChecklist[];
}

/** Espelha o UsuarioOpcaoDTO: só o necessário para escolher e exibir responsáveis. */
export interface UsuarioOpcao {
  id: string;
  nome: string;
  avatarUrl: string | null;
  departamento?: string | null;
}

export interface FiltroDemandas {
  responsavel?: 'me' | string;
  abertas?: boolean;
}

export const COLUNAS: { status: StatusDemanda; rotulo: string; icone: string }[] = [
  { status: 'A_FAZER', rotulo: 'A fazer', icone: 'radio_button_unchecked' },
  { status: 'EM_ANDAMENTO', rotulo: 'Em andamento', icone: 'autorenew' },
  { status: 'EM_REVISAO', rotulo: 'Em revisão', icone: 'rate_review' },
  { status: 'CONCLUIDO', rotulo: 'Concluído', icone: 'check_circle' },
];

export const URGENCIAS: Record<UrgenciaDemanda, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

export const TIPOS: Record<TipoDemanda, { rotulo: string; icone: string }> = {
  TAREFA: { rotulo: 'Tarefa', icone: 'task_alt' },
  BUG: { rotulo: 'Bug', icone: 'bug_report' },
  MELHORIA: { rotulo: 'Melhoria', icone: 'auto_awesome' },
  SOLICITACAO: { rotulo: 'Solicitação', icone: 'support_agent' },
};

export function rotuloDoStatus(status: StatusDemanda): string {
  return COLUNAS.find((c) => c.status === status)?.rotulo ?? status;
}
