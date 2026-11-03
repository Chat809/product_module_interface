import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const ROTAS_DE_AUTENTICACAO = `${environment.apiUrl}/auth/`;

function comToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Envia o token nas chamadas à API. Se a API responder 401, renova a sessão uma vez e repete a
 * requisição; se a renovação falhar, encerra a sessão e volta para o login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  if (!token || !req.url.startsWith(environment.apiUrl) || req.url.startsWith(ROTAS_DE_AUTENTICACAO)) {
    return next(req);
  }

  return next(comToken(req, token)).pipe(
    catchError((erro: HttpErrorResponse) => {
      if (erro.status !== 401) {
        return throwError(() => erro);
      }
      return auth.renovar().pipe(
        catchError(() => {
          auth.sair();
          return throwError(() => erro);
        }),
        switchMap((sessao) => next(comToken(req, sessao.accessToken))),
      );
    }),
  );
};
