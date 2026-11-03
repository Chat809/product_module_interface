import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Notificacao } from '../feedback/notificacao.service';

/** Corpo de erro da API no formato RFC 9457 (Problem Details). */
export interface ProblemDetail {
  title?: string;
  status?: number;
  detail?: string;
  erros?: { campo: string; mensagem: string }[];
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificacao = inject(Notificacao);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      notificacao.erro(mensagemDeErro(error));
      return throwError(() => error);
    }),
  );
};

function mensagemDeErro(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Não foi possível conectar à API. Verifique sua conexão e tente novamente.';
  }
  const problem = error.error as ProblemDetail | null;
  return problem?.detail ?? 'Ocorreu um erro inesperado. Tente novamente.';
}
