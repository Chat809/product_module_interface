import { WritableSignal } from '@angular/core';
import { MonoTypeOperatorFunction, defer, finalize, timeout } from 'rxjs';

/** O plano gratuito do Render hiberna a API sem uso; o primeiro acesso depois disso leva até ~1 min. */
export const AVISO_DE_DEMORA_MS = 5_000;
export const LIMITE_DE_ESPERA_MS = 90_000;

/**
 * Liga `demorando` quando a resposta passa de alguns segundos e desiste após o limite,
 * emitindo `TimeoutError`, para o carregamento nunca ficar infinito.
 */
export function acompanharEspera<T>(demorando: WritableSignal<boolean>): MonoTypeOperatorFunction<T> {
  return (origem) =>
    defer(() => {
      const aviso = setTimeout(() => demorando.set(true), AVISO_DE_DEMORA_MS);
      return origem.pipe(
        timeout(LIMITE_DE_ESPERA_MS),
        finalize(() => {
          clearTimeout(aviso);
          demorando.set(false);
        }),
      );
    });
}
