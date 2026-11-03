import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Sem sessão, manda para o login guardando a rota pedida para voltar depois. */
export const authGuard: CanActivateFn = (_rota, estado) =>
  inject(AuthService).logado() ||
  inject(Router).createUrlTree(['/login'], { queryParams: { voltar: estado.url } });

export const adminGuard: CanActivateFn = () =>
  inject(AuthService).ehAdmin() || inject(Router).createUrlTree(['/dashboard']);

/** Login e registro não fazem sentido para quem já entrou. */
export const visitanteGuard: CanActivateFn = () =>
  !inject(AuthService).logado() || inject(Router).createUrlTree(['/dashboard']);
