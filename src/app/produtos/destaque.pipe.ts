import { Pipe, PipeTransform } from '@angular/core';
import { TrechoDestacado, destacar } from './produto-filtro';

/** Divide o texto em trechos para o template marcar os termos encontrados, sem usar innerHTML. */
@Pipe({ name: 'destaque' })
export class DestaquePipe implements PipeTransform {
  transform(texto: string | null, termos: string[]): TrechoDestacado[] {
    return destacar(texto ?? '', termos);
  }
}
