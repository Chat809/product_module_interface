import { FabricaDeTela } from './tela.model';

/** Telas declarativas por subaba; cada módulo é carregado só quando alguém abre uma tela dele. */
export const TELAS: Record<string, () => Promise<FabricaDeTela>> = {
  'configuracoes/campos-extras': () => import('./definicoes/configuracoes').then((m) => m.camposExtras),
  'configuracoes/listas': () => import('./definicoes/configuracoes').then((m) => m.listas),
  'configuracoes/numeracao': () => import('./definicoes/configuracoes').then((m) => m.numeracao),
  'configuracoes/grupos': () => import('./definicoes/configuracoes').then((m) => m.grupos),
  'configuracoes/modelos-comunicacao': () => import('./definicoes/configuracoes').then((m) => m.modelosComunicacao),
  'financeiro/contas-bancarias': () => import('./definicoes/financeiro').then((m) => m.contasBancarias),
  'financeiro/fluxo-caixa': () => import('./definicoes/financeiro').then((m) => m.fluxoCaixa),
  'financeiro/plano-contas': () => import('./definicoes/financeiro').then((m) => m.planoContas),
  'financeiro/cartoes': () => import('./definicoes/financeiro').then((m) => m.cartoes),
  'financeiro/creditos': () => import('./definicoes/financeiro').then((m) => m.creditos),
  'financeiro/cotacoes': () => import('./definicoes/financeiro').then((m) => m.cotacoes),
  'comercial/propostas': () => import('./definicoes/comercial').then((m) => m.propostas),
  'comercial/pedidos': () => import('./definicoes/comercial').then((m) => m.pedidos),
  'comercial/tabelas-preco': () => import('./definicoes/comercial').then((m) => m.tabelasPreco),
  'comercial/comissoes': () => import('./definicoes/comercial').then((m) => m.comissoes),
  'comercial/metas': () => import('./definicoes/comercial').then((m) => m.metas),
  'crm/pesquisas': () => import('./definicoes/crm').then((m) => m.pesquisas),
  'crm/jornadas': () => import('./definicoes/crm').then((m) => m.jornadas),
  'demandas/quadros': () => import('./definicoes/operacao').then((m) => m.quadros),
  'demandas/roteiros': () => import('./definicoes/operacao').then((m) => m.roteiros),
  'rh/vagas': () => import('./definicoes/rh').then((m) => m.vagas),
  'rh/candidatos': () => import('./definicoes/rh').then((m) => m.candidatos),
};
