import { CLIENTE } from '../../cliente/cliente';
import { ChaveSubaba, Modulo, Papel, Usuario } from './auth.model';

export const ACESSO_TOTAL = '*';

/** Nível de acesso no sistema (o `papel` do perfil); cargo e departamento são outra coisa. */
export const ROTULOS_PAPEL: Record<Papel, string> = {
  ADMIN: 'Administrador',
  USUARIO: 'Usuário',
};

/** Contas novas recebem este padrão, o mesmo do banco. */
export const ACESSOS_PADRAO: string[] = ['inicio/dashboard', 'estoque/produtos', 'demandas/quadro'];

export interface DefinicaoDeSubaba {
  chave: ChaveSubaba;
  rotulo: string;
  icone: string;
  rota: string;
  /** Nunca liberada para usuários comuns (igual a `chaves_somente_admin()` no banco). */
  somenteAdmin?: boolean;
  /** Vale para qualquer pessoa logada, sem precisar ser liberada. */
  livre?: boolean;
}

export interface DefinicaoDeModulo {
  chave: Modulo;
  rotulo: string;
  icone: string;
  subabas: DefinicaoDeSubaba[];
}

function subaba(chave: ChaveSubaba, rotulo: string, icone: string, extra: Partial<DefinicaoDeSubaba> = {}): DefinicaoDeSubaba {
  return { chave, rotulo, icone, rota: `/${chave}`, ...extra };
}

/** Na mesma ordem do menu. As chaves são as usadas por `pode_acessar()` nas políticas do banco. */
const MODULOS_DA_BASE: DefinicaoDeModulo[] = [
  {
    chave: 'inicio',
    rotulo: 'Início',
    icone: 'home',
    subabas: [subaba('inicio/dashboard', 'Dashboard', 'dashboard')],
  },
  {
    chave: 'estoque',
    rotulo: 'Estoque',
    icone: 'inventory_2',
    subabas: [subaba('estoque/produtos', 'Produtos', 'category')],
  },
  {
    chave: 'demandas',
    rotulo: 'Demandas',
    icone: 'view_kanban',
    subabas: [
      subaba('demandas/quadro', 'Quadro', 'view_week'),
      subaba('demandas/agenda', 'Agenda', 'calendar_month'),
      subaba('demandas/quadros', 'Quadros e colunas', 'dashboard_customize'),
      subaba('demandas/roteiros', 'Roteiros', 'checklist'),
    ],
  },
  {
    chave: 'financeiro',
    rotulo: 'Financeiro',
    icone: 'payments',
    subabas: [
      subaba('financeiro/contas-pagar', 'Contas a pagar', 'call_made'),
      subaba('financeiro/contas-receber', 'Contas a receber', 'call_received'),
      subaba('financeiro/fluxo-caixa', 'Fluxo de caixa', 'waterfall_chart'),
      subaba('financeiro/contas-bancarias', 'Contas bancárias', 'account_balance'),
      subaba('financeiro/cartoes', 'Cartões corporativos', 'credit_card'),
      subaba('financeiro/creditos', 'Créditos de clientes', 'savings'),
      subaba('financeiro/fornecedores', 'Fornecedores', 'local_shipping'),
      subaba('financeiro/centros-custo', 'Centros de custo', 'account_tree'),
      subaba('financeiro/plano-contas', 'Plano de contas', 'format_list_numbered'),
      subaba('financeiro/cotacoes', 'Cotações de moeda', 'currency_exchange'),
    ],
  },
  {
    chave: 'comercial',
    rotulo: 'Comercial',
    icone: 'storefront',
    subabas: [
      subaba('comercial/propostas', 'Propostas', 'request_quote'),
      subaba('comercial/pedidos', 'Pedidos', 'shopping_cart'),
      subaba('comercial/tabelas-preco', 'Tabelas de preço', 'sell'),
      subaba('comercial/comissoes', 'Comissões', 'percent'),
      subaba('comercial/metas', 'Metas e ranking', 'emoji_events'),
    ],
  },
  {
    chave: 'crm',
    rotulo: 'CRM',
    icone: 'handshake',
    subabas: [
      subaba('crm/clientes', 'Clientes', 'contacts'),
      subaba('crm/leads', 'Leads', 'person_add'),
      subaba('crm/reclamacoes', 'Reclamações', 'report_problem'),
      subaba('crm/pesquisas', 'Pesquisas de satisfação', 'reviews'),
      subaba('crm/jornadas', 'Jornadas', 'route'),
    ],
  },
  {
    chave: 'rh',
    rotulo: 'Recrutamento',
    icone: 'badge',
    subabas: [subaba('rh/vagas', 'Vagas', 'work'), subaba('rh/candidatos', 'Candidatos', 'person_search')],
  },
  {
    chave: 'relatorios',
    rotulo: 'Relatórios',
    icone: 'bar_chart',
    subabas: [
      subaba('relatorios/financeiro', 'Financeiro', 'account_balance'),
      subaba('relatorios/dre', 'DRE', 'summarize'),
      subaba('relatorios/comercial', 'Comercial', 'trending_up'),
      subaba('relatorios/estoque', 'Estoque', 'inventory'),
      subaba('relatorios/atendimento', 'Atendimento', 'support_agent'),
      subaba('relatorios/satisfacao', 'Satisfação', 'sentiment_satisfied'),
    ],
  },
  {
    chave: 'configuracoes',
    rotulo: 'Configurações',
    icone: 'settings',
    subabas: [
      subaba('configuracoes/usuarios', 'Usuários e acessos', 'group', { somenteAdmin: true }),
      subaba('configuracoes/grupos', 'Grupos de permissão', 'groups', { somenteAdmin: true }),
      subaba('configuracoes/sistema', 'Marca e módulos', 'palette', { somenteAdmin: true }),
      subaba('configuracoes/parametros-crm', 'Parâmetros do CRM', 'tune', { somenteAdmin: true }),
      subaba('configuracoes/campos-extras', 'Campos extras', 'dynamic_form'),
      subaba('configuracoes/listas', 'Listas auxiliares', 'list_alt'),
      subaba('configuracoes/numeracao', 'Numeração', 'pin'),
      subaba('configuracoes/modelos-comunicacao', 'Modelos de comunicação', 'drafts'),
      subaba('configuracoes/notificacoes', 'Notificações', 'notifications', { livre: true }),
      subaba('configuracoes/webhooks', 'Webhooks', 'webhook', { somenteAdmin: true }),
      subaba('configuracoes/integracoes', 'Integrações', 'hub', { somenteAdmin: true }),
      subaba('configuracoes/auditoria', 'Auditoria', 'history', { somenteAdmin: true }),
    ],
  },
];

export const MODULOS: DefinicaoDeModulo[] = [...MODULOS_DA_BASE, ...CLIENTE.modulosExtras];

export const SUBABAS: DefinicaoDeSubaba[] = MODULOS.flatMap((m) => m.subabas);

/** Chaves gravadas antes da divisão em subabas, que o banco continua aceitando. */
const CHAVES_ANTIGAS: Record<string, Modulo> = { dashboard: 'inicio', produtos: 'estoque' };

function moduloDa(chave: ChaveSubaba): Modulo {
  return chave.split('/')[0] as Modulo;
}

/**
 * Mesma regra de `acessos_cobrem()` no banco: administradores acessam tudo; para os demais, `'*'` libera tudo
 * exceto as subabas de administrador, e a chave de um módulo libera todas as subabas dele. O banco é quem decide
 * de fato (RLS): isto só monta menu e rotas.
 */
export function podeAcessar(usuario: Usuario | null, chave: ChaveSubaba): boolean {
  if (!usuario) {
    return false;
  }
  if (usuario.papel === 'ADMIN') {
    return true;
  }
  const subaba = SUBABAS.find((s) => s.chave === chave);
  if (!subaba || subaba.somenteAdmin) {
    return false;
  }
  if (subaba.livre) {
    return true;
  }
  const acessos = usuario.acessos ?? ACESSOS_PADRAO;
  const modulo = moduloDa(chave);
  return acessos.some(
    (acesso) => acesso === ACESSO_TOTAL || acesso === chave || acesso === modulo || CHAVES_ANTIGAS[acesso] === modulo,
  );
}

/**
 * O módulo aparece no menu se estiver ligado em `modulos_ativos` e a pessoa puder abrir ao menos uma subaba dele.
 * `ligados` nulo (configuração ainda não lida) não esconde nada.
 */
export function menuDe(usuario: Usuario | null, ligados: ReadonlySet<string> | null = null): DefinicaoDeModulo[] {
  return MODULOS.filter(
    (m) => !ligados || ligados.has(m.chave) || m.chave === 'configuracoes' || CLIENTE.modulosExtras.includes(m),
  )
    .map((m) => ({ ...m, subabas: m.subabas.filter((s) => podeAcessar(usuario, s.chave)) }))
    .filter((m) => m.subabas.length > 0);
}

/** Rótulos curtos dos acessos ("CRM", "Financeiro › Fornecedores"), para chips e resumos. */
export function rotulosDosAcessos(usuario: Usuario): string[] {
  if (usuario.papel === 'ADMIN' || usuario.acessos.includes(ACESSO_TOTAL)) {
    return ['Acesso total'];
  }
  return MODULOS.flatMap((m) => {
    const liberadas = m.subabas.filter((s) => !s.livre && podeAcessar(usuario, s.chave));
    if (liberadas.length === 0) {
      return [];
    }
    if (liberadas.length === m.subabas.filter((s) => !s.livre && !s.somenteAdmin).length) {
      return [m.rotulo];
    }
    return liberadas.map((s) => (m.subabas.length > 1 ? `${m.rotulo} › ${s.rotulo}` : m.rotulo));
  });
}

/** Texto curto para exibir os acessos de alguém, por exemplo "Início, Estoque". */
export function descreverAcessos(usuario: Usuario): string {
  const rotulos = rotulosDosAcessos(usuario);
  return rotulos.length ? rotulos.join(', ') : 'Nenhum módulo';
}
