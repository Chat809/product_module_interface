import { calcularImposto, hojeIso } from './financeiro.model';

describe('financeiro.model', () => {
  it('deve calcular imposto e líquido como o banco, arredondando em centavos', () => {
    expect(calcularImposto(2500, 6.5)).toEqual({ imposto: 162.5, liquido: 2337.5 });
    expect(calcularImposto(100, 0)).toEqual({ imposto: 0, liquido: 100 });
    expect(calcularImposto(10, 3.33)).toEqual({ imposto: 0.33, liquido: 9.67 });
    expect(calcularImposto(0.1, 15)).toEqual({ imposto: 0.02, liquido: 0.08 });
    expect(calcularImposto(1234.56, 100)).toEqual({ imposto: 1234.56, liquido: 0 });
  });

  it('deve formatar a data local como aaaa-mm-dd', () => {
    expect(hojeIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
