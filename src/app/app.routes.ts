import { Routes } from '@angular/router';

const produtoForm = () => import('./produtos/produto-form/produto-form').then((m) => m.ProdutoForm);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'produtos' },
  {
    path: 'produtos',
    title: 'Produtos',
    loadComponent: () => import('./produtos/produto-list/produto-list').then((m) => m.ProdutoList),
  },
  { path: 'produtos/novo', title: 'Novo produto', loadComponent: produtoForm },
  { path: 'produtos/:id/editar', title: 'Editar produto', loadComponent: produtoForm },
  { path: '**', redirectTo: 'produtos' },
];
