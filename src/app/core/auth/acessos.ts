import { ChaveSubaba, Modulo, Papel, Usuario } from './auth.model';

export const ACESSO_TOTAL = '*';

/** Nível de acesso no sistema (o `papel` da API); cargo e departamento são outra coisa. */
export const ROTULOS_PAPEL: Record<Papel, string> = {
  ADMIN: 'Administrador',
  USUARIO: 'Usuário',
};

/** Contas novas e sessões salvas antes da coluna `acessos` existir recebem este padrão, como na API. */
export const ACESSOS_PADRAO: string[] = ['inicio/dashboard', 'estoque/produtos', 'demandas/quadro'];

export interface DefinicaoDeSubaba {
  chave: ChaveSubaba;
  rotulo: string;
  icone: string;
  rota: string;
  /** Nunca liberada para usuários comuns. */
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

/** Na mesma ordem do menu e do enum Submodulo da API. */
export const MODULOS: DefinicaoDeModulo[] = [
  {
    chave: 'inicio',
    rotulo: 'Início',
    icone: 'home',
    subabas: [{ chave: 'inicio/dashboard', rotulo: 'Dashboard', icone: 'dashboard', rota: '/inicio/dashboard' }],
  },
  {
    chave: 'estoque',
    rotulo: 'Estoque',
    icone: 'inventory_2',
    subabas: [{ chave: 'estoque/produtos', rotulo: 'Produtos', icone: 'category', rota: '/estoque/produtos' }],
  },
  {
    chave: 'demandas',
    rotulo: 'Demandas',
    icone: 'view_kanban',
    subabas: [{ chave: 'demandas/quadro', rotulo: 'Quadro', icone: 'view_week', rota: '/demandas/quadro' }],
  },
  {
    chave: 'financeiro',
    rotulo: 'Financeiro',
    icone: 'payments',
    subabas: [
      { chave: 'financeiro/contas-pagar', rotulo: 'Contas a pagar', icone: 'call_made', rota: '/financeiro/contas-pagar' },
      {
        chave: 'financeiro/contas-receber',
        rotulo: 'Contas a receber',
        icone: 'call_received',
        rota: '/financeiro/contas-receber',
      },
      { chave: 'financeiro/fornecedores', rotulo: 'Fornecedores', icone: 'local_shipping', rota: '/financeiro/fornecedores' },
      {
        chave: 'financeiro/centros-custo',
        rotulo: 'Centros de custo',
        icone: 'account_tree',
        rota: '/financeiro/centros-custo',
      },
    ],
  },
  {
    chave: 'crm',
    rotulo: 'CRM',
    icone: 'handshake',
    subabas: [
      { chave: 'crm/clientes', rotulo: 'Clientes', icone: 'contacts', rota: '/crm/clientes' },
      { chave: 'crm/leads', rotulo: 'Leads', icone: 'person_add', rota: '/crm/leads' },
      { chave: 'crm/reclamacoes', rotulo: 'Reclamações', icone: 'report_problem', rota: '/crm/reclamacoes' },
    ],
  },
  {
    chave: 'relatorios',
    rotulo: 'Relatórios',
    icone: 'bar_chart',
    subabas: [
      { chave: 'relatorios/financeiro', rotulo: 'Financeiro', icone: 'account_balance', rota: '/relatorios/financeiro' },
      { chave: 'relatorios/comercial', rotulo: 'Comercial', icone: 'trending_up', rota: '/relatorios/comercial' },
      { chave: 'relatorios/estoque', rotulo: 'Estoque', icone: 'inventory', rota: '/relatorios/estoque' },
      { chave: 'relatorios/atendimento', rotulo: 'Atendimento', icone: 'support_agent', rota: '/relatorios/atendimento' },
    ],
  },
  {
    chave: 'configuracoes',
    rotulo: 'Configurações',
    icone: 'settings',
    subabas: [
      {
        chave: 'configuracoes/usuarios',
        rotulo: 'Usuários e acessos',
        icone: 'group',
        rota: '/configuracoes/usuarios',
        somenteAdmin: true,
      },
      {
        chave: 'configuracoes/parametros-crm',
        rotulo: 'Parâmetros do CRM',
        icone: 'tune',
        rota: '/configuracoes/parametros-crm',
        somenteAdmin: true,
      },
      {
        chave: 'configuracoes/notificacoes',
        rotulo: 'Notificações',
        icone: 'notifications',
        rota: '/configuracoes/notificacoes',
        livre: true,
      },
      { chave: 'configuracoes/webhooks', rotulo: 'Webhooks', icone: 'webhook', rota: '/configuracoes/webhooks', somenteAdmin: true },
      {
        chave: 'configuracoes/integracoes',
        rotulo: 'Integrações',
        icone: 'hub',
        rota: '/configuracoes/integracoes',
        somenteAdmin: true,
      },
    ],
  },
];

export const SUBABAS: DefinicaoDeSubaba[] = MODULOS.flatMap((m) => m.subabas);

/** Chaves gravadas antes da divisão em subabas, que a API continua aceitando. */
const CHAVES_ANTIGAS: Record<string, Modulo> = { dashboard: 'inicio', produtos: 'estoque' };

function moduloDa(chave: ChaveSubaba): Modulo {
  return chave.split('/')[0] as Modulo;
}

/**
 * Mesma regra de `Acessos.liberados` da API: administradores acessam tudo; para os demais, `'*'` libera tudo
 * exceto as subabas de administrador, e a chave de um módulo libera todas as subabas dele. A API é quem decide
 * de fato: isto só monta menu e rotas.
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

/** O módulo aparece no menu se a pessoa puder abrir ao menos uma subaba dele. */
export function menuDe(usuario: Usuario | null): DefinicaoDeModulo[] {
  return MODULOS.map((m) => ({ ...m, subabas: m.subabas.filter((s) => podeAcessar(usuario, s.chave)) })).filter(
    (m) => m.subabas.length > 0,
  );
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
