import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, moduloGuard, visitanteGuard } from './core/auth/auth.guards';
import { AuthService } from './core/auth/auth.service';
import { Shell } from './core/layout/shell';

const rotaInicial = () => inject(AuthService).rotaInicial();

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
      { path: '', pathMatch: 'full', redirectTo: rotaInicial },
      {
        path: 'dashboard',
        title: 'Dashboard',
        canActivate: [moduloGuard('dashboard')],
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'produtos',
        title: 'Produtos',
        canActivate: [moduloGuard('produtos')],
        loadComponent: () => import('./produtos/produto-list/produto-list').then((m) => m.ProdutoList),
      },
      {
        path: 'usuarios',
        title: 'Usuários',
        canActivate: [moduloGuard('usuarios')],
        loadComponent: () => import('./usuarios/usuario-list/usuario-list').then((m) => m.UsuarioList),
      },
      {
        path: 'sem-acesso',
        title: 'Sem acesso',
        loadComponent: () => import('./core/layout/sem-acesso').then((m) => m.SemAcesso),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
