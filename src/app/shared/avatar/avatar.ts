import { Component, computed, input, linkedSignal } from '@angular/core';

/** Foto do usuário ou, sem foto (ou se ela não carregar), as iniciais do nome sobre a cor do tema. */
@Component({
  selector: 'app-avatar',
  template: `
    @if (url() && !falhou()) {
      <img [src]="url()" [alt]="'Foto de ' + nome()" (error)="falhou.set(true)" />
    } @else {
      <span aria-hidden="true">{{ iniciais() }}</span>
    }
  `,
  host: {
    class: 'avatar',
    '[style.--tamanho.px]': 'tamanho()',
    '[attr.title]': 'comDica() ? nome() : null',
  },
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: var(--tamanho);
      height: var(--tamanho);
      border-radius: 50%;
      overflow: hidden;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-size: calc(var(--tamanho) * 0.4);
      font-weight: 500;
      line-height: 1;
      user-select: none;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class Avatar {
  readonly nome = input('');
  readonly url = input<string | null | undefined>(null);
  readonly tamanho = input(32);
  readonly comDica = input(false);

  /** Volta a tentar a imagem sempre que a URL muda. */
  protected readonly falhou = linkedSignal({ source: this.url, computation: () => false });

  protected readonly iniciais = computed(() => {
    const partes = this.nome().trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) {
      return '?';
    }
    const primeira = partes[0][0];
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primeira + ultima).toUpperCase();
  });
}
