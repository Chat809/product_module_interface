import { Routes } from '@angular/router';

export const routes: Routes = [
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
  { path: '**', redirectTo: 'dashboard' },
];
