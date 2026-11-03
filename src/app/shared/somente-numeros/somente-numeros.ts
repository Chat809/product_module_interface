import { Directive, booleanAttribute, input } from '@angular/core';

/**
 * Restringe a digitação a números. Necessária porque `type="number"` ainda aceita
 * caracteres como `e`, `+` e `-`.
 */
@Directive({
  selector: 'input[appSomenteNumeros]',
  host: {
    '[attr.inputmode]': 'decimal() ? "decimal" : "numeric"',
    '(keydown)': 'aoDigitar($event)',
    '(paste)': 'aoColar($event)',
  },
})
export class SomenteNumeros {
  /** Permite separador decimal (ponto ou vírgula). */
  readonly decimal = input(false, { transform: booleanAttribute });

  protected aoDigitar(evento: KeyboardEvent): void {
    const teclaDeControle = evento.key.length > 1 || evento.ctrlKey || evento.metaKey;
    if (!teclaDeControle && !this.permitido(evento.key)) {
      evento.preventDefault();
    }
  }

  protected aoColar(evento: ClipboardEvent): void {
    const texto = evento.clipboardData?.getData('text') ?? '';
    if (![...texto].every((caractere) => this.permitido(caractere))) {
      evento.preventDefault();
    }
  }

  private permitido(caractere: string): boolean {
    return /\d/.test(caractere) || (this.decimal() && (caractere === '.' || caractere === ','));
  }
}
