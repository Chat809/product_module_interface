import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CLIENTE } from '../../cliente/cliente';
import { ConfiguracaoService } from '../../core/configuracao/configuracao.service';

/** Logo (ou ícone) e nome do cliente, vindos de `parametros_sistema.marca`. */
@Component({
  selector: 'app-marca',
  imports: [MatIconModule],
  template: `
    @if (marca().logoUrl; as logo) {
      <img [src]="logo" alt="" class="logo" />
    } @else {
      <mat-icon>{{ icone }}</mat-icon>
    }
    <span>{{ marca().nome }}</span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .logo {
      height: 28px;
      max-width: 120px;
      object-fit: contain;
    }
  `,
})
export class Marca {
  protected readonly marca = inject(ConfiguracaoService).marca;
  protected readonly icone = CLIENTE.iconeDaMarca;
}
