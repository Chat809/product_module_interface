import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, subabaGuard, visitanteGuard } from './core/auth/auth.guards';
import { Modulo } from './core/auth/auth.model';
import { AuthService } from './core/auth/auth.service';
import { Shell } from './core/layout/shell';

const rotaInicial = () => inject(AuthService).rotaInicial();

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
        ],
      },
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
