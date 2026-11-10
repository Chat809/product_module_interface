import { inject } from '@angular/core';
import { Route, Routes } from '@angular/router';
import { CLIENTE } from './cliente/cliente';
import { authGuard, subabaGuard, visitanteGuard } from './core/auth/auth.guards';
import { ChaveSubaba, Modulo } from './core/auth/auth.model';
import { AuthService } from './core/auth/auth.service';
import { Shell } from './core/layout/shell';

const rotaInicial = () => inject(AuthService).rotaInicial();

/** Subaba montada pelas definições de `telas/registro.ts`. */
function tela(chave: ChaveSubaba, title: string): Route {
  return {
    path: chave.split('/')[1],
    title,
    data: { tela: chave },
    canActivate: [subabaGuard(chave)],
    loadComponent: () => import('./telas/pagina-telas').then((m) => m.PaginaTelas),
  };
}

function relatorio(tipo: string, title: string): Route {
  return {
    path: tipo,
    title,
    data: { tipo },
    canActivate: [subabaGuard(`relatorios/${tipo}`)],
    loadComponent: () => import('./relatorios/relatorio-page').then((m) => m.RelatorioPage),
  };
}

/** Abrir só o módulo (`/financeiro`) leva à primeira subaba dele que a pessoa pode usar. */
const primeiraSubaba = (modulo: Modulo) => () => {
  const auth = inject(AuthService);
  return auth.menu().find((m) => m.chave === modulo)?.subabas[0]?.rota ?? auth.rotaInicial();
};

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar',
    canActivate: [visitanteGuard],
    loadComponent: () => import('./auth/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    title: 'Criar conta',
    canActivate: [visitanteGuard],
    loadComponent: () => import('./auth/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'auth/callback',
    title: 'Entrando com Google',
    loadComponent: () => import('./auth/google-callback/google-callback').then((m) => m.GoogleCallback),
  },
  {
    path: 'p/:token',
    title: 'Formulário',
    loadComponent: () => import('./publico/pagina-publica').then((m) => m.PaginaPublica),
  },
  {
    path: 'trabalhe-conosco',
    title: 'Trabalhe conosco',
    loadComponent: () => import('./publico/trabalhe-conosco').then((m) => m.TrabalheConosco),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: rotaInicial },
      {
        path: 'inicio',
        children: [
          { path: '', pathMatch: 'full', redirectTo: primeiraSubaba('inicio') },
          {
            path: 'dashboard',
            title: 'Dashboard',
            canActivate: [subabaGuard('inicio/dashboard')],
            loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
          },
        ],
      },
      {
        path: 'estoque',
        children: [
          { path: '', pathMatch: 'full', redirectTo: primeiraSubaba('estoque') },
          {
            path: 'produtos',
            title: 'Produtos',
            canActivate: [subabaGuard('estoque/produtos')],
            loadComponent: () => import('./produtos/produto-list/produto-list').then((m) => m.ProdutoList),
          },
        ],
      },
      {
        path: 'demandas',
        children: [
          { path: '', pathMatch: 'full', redirectTo: primeiraSubaba('demandas') },
          {
            path: 'quadro',
            title: 'Demandas',
            canActivate: [subabaGuard('demandas/quadro')],
            loadComponent: () => import('./demandas/demanda-board/demanda-board').then((m) => m.DemandaBoard),
          },
          {
            path: 'agenda',
            title: 'Agenda',
            canActivate: [subabaGuard('demandas/agenda')],
            loadComponent: () => import('./demandas/agenda/agenda').then((m) => m.Agenda),
          },
          tela('demandas/quadros', 'Quadros'),
          tela('demandas/roteiros', 'Roteiros'),
        ],
      },
      {
        path: 'financeiro',
        children: [
          { path: '', pathMatch: 'full', redirectTo: primeiraSubaba('financeiro') },
          {
            path: 'contas-pagar',
            title: 'Contas a pagar',
            data: { tipo: 'contas-pagar' },
            canActivate: [subabaGuard('financeiro/contas-pagar')],
            loadComponent: () => import('./financeiro/financeiro-page/financeiro-page').then((m) => m.FinanceiroPage),
          },
          {
            path: 'contas-receber',
            title: 'Contas a receber',
            data: { tipo: 'contas-receber' },
            canActivate: [subabaGuard('financeiro/contas-receber')],
            loadComponent: () => import('./financeiro/financeiro-page/financeiro-page').then((m) => m.FinanceiroPage),
          },
          {
            path: 'fornecedores',
            title: 'Fornecedores',
            canActivate: [subabaGuard('financeiro/fornecedores')],
            loadComponent: () => import('./financeiro/fornecedores/fornecedores').then((m) => m.Fornecedores),
          },
          {
            path: 'centros-custo',
            title: 'Centros de custo',
            canActivate: [subabaGuard('financeiro/centros-custo')],
            loadComponent: () => import('./financeiro/centros-custo/centros-custo').then((m) => m.CentrosCusto),
          },
          tela('financeiro/fluxo-caixa', 'Fluxo de caixa'),
          tela('financeiro/contas-bancarias', 'Contas bancárias'),
          tela('financeiro/cartoes', 'Cartões corporativos'),
          tela('financeiro/creditos', 'Créditos de clientes'),
          tela('financeiro/plano-contas', 'Plano de contas'),
          tela('financeiro/cotacoes', 'Cotações de moeda'),
        ],
      },
      {
        path: 'comercial',
        children: [
          { path: '', pathMatch: 'full', redirectTo: primeiraSubaba('comercial') },
          tela('comercial/propostas', 'Propostas'),
          tela('comercial/pedidos', 'Pedidos'),
          tela('comercial/tabelas-preco', 'Tabelas de preço'),
          tela('comercial/comissoes', 'Comissões'),
          tela('comercial/metas', 'Metas e ranking'),
        ],
      },
      {
        path: 'rh',
        children: [
          { path: '', pathMatch: 'full', redirectTo: primeiraSubaba('rh') },
          tela('rh/vagas', 'Vagas'),
          tela('rh/candidatos', 'Candidatos'),
        ],
      },
      {
        path: 'crm',
        children: [
          { path: '', pathMatch: 'full', redirectTo: primeiraSubaba('crm') },
          {
            path: 'clientes',
            title: 'Clientes',
            canActivate: [subabaGuard('crm/clientes')],
            loadComponent: () => import('./crm/clientes/clientes').then((m) => m.Clientes),
          },
          {
            path: 'leads',
            title: 'Leads',
            canActivate: [subabaGuard('crm/leads')],
            loadComponent: () => import('./crm/leads/leads').then((m) => m.Leads),
          },
          {
            path: 'reclamacoes',
            title: 'Reclamações',
            canActivate: [subabaGuard('crm/reclamacoes')],
            loadComponent: () => import('./crm/reclamacoes/reclamacoes').then((m) => m.Reclamacoes),
          },
          tela('crm/pesquisas', 'Pesquisas de satisfação'),
          tela('crm/jornadas', 'Jornadas'),
        ],
      },
      {
        path: 'relatorios',
        children: [
          { path: '', pathMatch: 'full', redirectTo: primeiraSubaba('relatorios') },
          {
            path: 'financeiro',
            title: 'Relatório financeiro',
            data: { tipo: 'financeiro' },
            canActivate: [subabaGuard('relatorios/financeiro')],
            loadComponent: () => import('./relatorios/relatorio-page').then((m) => m.RelatorioPage),
          },
          {
            path: 'comercial',
            title: 'Relatório comercial',
            data: { tipo: 'comercial' },
            canActivate: [subabaGuard('relatorios/comercial')],
            loadComponent: () => import('./relatorios/relatorio-page').then((m) => m.RelatorioPage),
          },
          {
            path: 'estoque',
            title: 'Relatório de estoque',
            data: { tipo: 'estoque' },
            canActivate: [subabaGuard('relatorios/estoque')],
            loadComponent: () => import('./relatorios/relatorio-page').then((m) => m.RelatorioPage),
          },
          {
            path: 'atendimento',
            title: 'Relatório de atendimento',
            data: { tipo: 'atendimento' },
            canActivate: [subabaGuard('relatorios/atendimento')],
            loadComponent: () => import('./relatorios/relatorio-page').then((m) => m.RelatorioPage),
          },
          relatorio('dre', 'DRE'),
          relatorio('satisfacao', 'Satisfação'),
        ],
      },
      {
        path: 'configuracoes',
        children: [
          { path: '', pathMatch: 'full', redirectTo: primeiraSubaba('configuracoes') },
          {
            path: 'usuarios',
            title: 'Usuários e acessos',
            canActivate: [subabaGuard('configuracoes/usuarios')],
            loadComponent: () => import('./usuarios/usuario-list/usuario-list').then((m) => m.UsuarioList),
          },
          {
            path: 'parametros-crm',
            title: 'Parâmetros do CRM',
            canActivate: [subabaGuard('configuracoes/parametros-crm')],
            loadComponent: () => import('./configuracoes/parametros-crm/parametros-crm').then((m) => m.ParametrosCrm),
          },
          {
            path: 'notificacoes',
            title: 'Notificações',
            canActivate: [subabaGuard('configuracoes/notificacoes')],
            loadComponent: () =>
              import('./configuracoes/notificacoes/preferencias-notificacao').then((m) => m.PreferenciasNotificacaoPage),
          },
          {
            path: 'webhooks',
            title: 'Webhooks',
            canActivate: [subabaGuard('configuracoes/webhooks')],
            loadComponent: () => import('./configuracoes/webhooks/webhooks').then((m) => m.Webhooks),
          },
          {
            path: 'integracoes',
            title: 'Integrações',
            canActivate: [subabaGuard('configuracoes/integracoes')],
            loadComponent: () => import('./configuracoes/integracoes/integracoes').then((m) => m.Integracoes),
          },
          {
            path: 'sistema',
            title: 'Sistema',
            canActivate: [subabaGuard('configuracoes/sistema')],
            loadComponent: () => import('./configuracoes/sistema/sistema').then((m) => m.Sistema),
          },
          {
            path: 'auditoria',
            title: 'Auditoria',
            canActivate: [subabaGuard('configuracoes/auditoria')],
            loadComponent: () => import('./configuracoes/auditoria/auditoria').then((m) => m.Auditoria),
          },
          tela('configuracoes/campos-extras', 'Campos extras'),
          tela('configuracoes/listas', 'Listas auxiliares'),
          tela('configuracoes/numeracao', 'Numeração de documentos'),
          tela('configuracoes/grupos', 'Grupos de permissão'),
          tela('configuracoes/modelos-comunicacao', 'Modelos de comunicação'),
        ],
      },
      ...CLIENTE.rotasExtras,
      {
        path: 'perfil',
        title: 'Meu perfil',
        loadComponent: () => import('./perfil/meu-perfil/meu-perfil').then((m) => m.MeuPerfilPage),
      },
      {
        path: 'sem-acesso',
        title: 'Sem acesso',
        loadComponent: () => import('./core/layout/sem-acesso').then((m) => m.SemAcesso),
      },
      { path: 'dashboard', redirectTo: 'inicio/dashboard' },
      { path: 'produtos', redirectTo: 'estoque/produtos' },
      { path: 'usuarios', redirectTo: 'configuracoes/usuarios' },
    ],
  },
  { path: '**', redirectTo: '' },
];
