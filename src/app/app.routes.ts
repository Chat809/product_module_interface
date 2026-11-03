import { Routes } from '@angular/router';
import { adminGuard, authGuard, visitanteGuard } from './core/auth/auth.guards';
import { Shell } from './core/layout/shell';

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
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'produtos',
        title: 'Produtos',
        loadComponent: () => import('./produtos/produto-list/produto-list').then((m) => m.ProdutoList),
      },
      {
        path: 'usuarios',
        title: 'Usuários',
        canActivate: [adminGuard],
        loadComponent: () => import('./usuarios/usuario-list/usuario-list').then((m) => m.UsuarioList),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
