import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

const CHAVE = 'painel-tema';

@Injectable({ providedIn: 'root' })
export class Tema {
  private readonly document = inject(DOCUMENT);

  readonly escuro = signal(this.preferenciaInicial());

  constructor() {
    effect(() => {
      this.document.body.classList.toggle('tema-escuro', this.escuro());
      localStorage.setItem(CHAVE, this.escuro() ? 'escuro' : 'claro');
    });
  }

  alternar(): void {
    this.escuro.update((escuro) => !escuro);
  }

  private preferenciaInicial(): boolean {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) {
      return salvo === 'escuro';
    }
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
