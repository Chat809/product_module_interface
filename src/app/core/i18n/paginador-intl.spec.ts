import { PaginadorIntl } from './paginador-intl';

describe('PaginadorIntl', () => {
  const intl = new PaginadorIntl();

  it('deve exibir os rótulos em português', () => {
    expect(intl.itemsPerPageLabel).toBe('Itens por página');
    expect(intl.nextPageLabel).toBe('Próxima página');
    expect(intl.previousPageLabel).toBe('Página anterior');
  });

  it('deve descrever o intervalo exibido', () => {
    expect(intl.getRangeLabel(0, 10, 15)).toBe('1 – 10 de 15');
    expect(intl.getRangeLabel(1, 10, 15)).toBe('11 – 15 de 15');
    expect(intl.getRangeLabel(0, 10, 0)).toBe('0 de 0');
  });
});
