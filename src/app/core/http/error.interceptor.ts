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
      const problem = error.error as ProblemDetail | null;
      switch (error.status) {
        case 0:
          notificacao.erro('Não foi possível conectar à API. Verifique sua conexão e tente novamente.');
          break;
        case 409:
          notificacao.aviso(
            'Este produto foi alterado por outra pessoa. Os dados foram atualizados; revise e tente de novo.',
          );
          break;
        case 422:
          notificacao.aviso(problem?.detail ?? 'A operação não pôde ser concluída.');
          break;
        case 400:
          notificacao.erro(
            problem?.erros?.length
              ? 'Verifique os campos destacados no formulário.'
              : (problem?.detail ?? 'Requisição inválida.'),
          );
          break;
        default:
          notificacao.erro(problem?.detail ?? 'Ocorreu um erro inesperado. Tente novamente.');
      }
      return throwError(() => error);
    }),
  );
};
