import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Modulo } from './auth.model';
import { AuthService } from './auth.service';

/** Sem sessão, manda para o login guardando a rota pedida para voltar depois. */
export const authGuard: CanActivateFn = (_rota, estado) =>
  inject(AuthService).logado() ||
  inject(Router).createUrlTree(['/login'], { queryParams: { voltar: estado.url } });

/** Libera a rota só para quem tem o módulo; os demais vão para o primeiro módulo que podem usar. */
export function moduloGuard(modulo: Modulo): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    return auth.podeAcessar(modulo) || inject(Router).parseUrl(auth.rotaInicial());
  };
}

/** Login e registro não fazem sentido para quem já entrou. */
export const visitanteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.logado() || inject(Router).parseUrl(auth.rotaInicial());
};
