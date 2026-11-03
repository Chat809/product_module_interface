import { signal } from '@angular/core';
import { NEVER, Subject, TimeoutError } from 'rxjs';
import { AVISO_DE_DEMORA_MS, LIMITE_DE_ESPERA_MS, acompanharEspera } from './espera';

describe('acompanharEspera', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('deve avisar da demora só depois de alguns segundos e limpar ao responder', () => {
    const demorando = signal(false);
    const resposta = new Subject<string>();
    resposta.pipe(acompanharEspera(demorando)).subscribe();

    vi.advanceTimersByTime(AVISO_DE_DEMORA_MS - 1);
    expect(demorando()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(demorando()).toBe(true);

    resposta.next('ok');
    resposta.complete();
    expect(demorando()).toBe(false);
  });

  it('não deve avisar quando a resposta chega rápido', () => {
    const demorando = signal(false);
    const resposta = new Subject<string>();
    resposta.pipe(acompanharEspera(demorando)).subscribe();

    resposta.next('ok');
    resposta.complete();
    vi.advanceTimersByTime(AVISO_DE_DEMORA_MS);

    expect(demorando()).toBe(false);
  });

  it('deve desistir com TimeoutError ao passar do limite', () => {
    const demorando = signal(false);
    let erro: unknown;
    NEVER.pipe(acompanharEspera(demorando)).subscribe({ error: (e) => (erro = e) });

    vi.advanceTimersByTime(LIMITE_DE_ESPERA_MS);

    expect(erro).toBeInstanceOf(TimeoutError);
    expect(demorando()).toBe(false);
  });
});
