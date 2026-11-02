import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

/** Corpo de erro da API no formato RFC 9457 (Problem Details). */
export interface ProblemDetail {
  title?: string;
  status?: number;
  detail?: string;
  erros?: { campo: string; mensagem: string }[];
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      snackBar.open(mensagemDeErro(error), 'Fechar', { duration: 5000 });
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
