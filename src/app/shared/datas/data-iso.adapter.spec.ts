import { TestBed } from '@angular/core/testing';
import { DateAdapter } from '@angular/material/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { DataIsoAdapter, PROVEDORES_DE_DATA } from './data-iso.adapter';

describe('DataIsoAdapter', () => {
  let adapter: DataIsoAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...PROVEDORES_DE_DATA] });
    adapter = TestBed.inject(DateAdapter) as DataIsoAdapter;
  });

  it('deve entender a data digitada em dd/mm/aaaa ou colada em ISO', () => {
    expect(adapter.parse('3/11/2026')).toBe('2026-11-03');
    expect(adapter.parse(' 2026-11-03 ')).toBe('2026-11-03');
    expect(adapter.parse('')).toBeNull();
  });

  it('deve marcar como inválida a data impossível ou em outro formato', () => {
    for (const texto of ['31/02/2026', '2026-13-01', '11-03-2026', 'amanhã']) {
      expect(adapter.isValid(adapter.parse(texto)!)).toBe(false);
    }
  });

  it('deve exibir em português sem mudar o dia por causa do fuso', () => {
    expect(adapter.format('2026-11-03', { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('03/11/2026');
    expect(adapter.getMonthNames('long')[0]).toBe('janeiro');
    expect(adapter.getDayOfWeek('2026-11-03')).toBe(2);
  });

  it('deve fazer as contas do calendário como o adaptador nativo', () => {
    expect(adapter.addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(adapter.addCalendarYears('2028-02-29', 1)).toBe('2029-02-28');
    expect(adapter.addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(adapter.getNumDaysInMonth('2028-02-10')).toBe(29);
    expect(adapter.createDate(2026, 10, 3)).toBe('2026-11-03');
    expect(() => adapter.createDate(2026, 1, 30)).toThrow();
  });

  it('deve anunciar os botões do calendário em português', () => {
    const intl = TestBed.inject(MatDatepickerIntl);
    expect(intl.openCalendarLabel).toBe('Abrir calendário');
    expect(intl.nextMonthLabel).toBe('Próximo mês');
  });

  it('deve tratar o valor vazio do formulário como sem data', () => {
    expect(adapter.deserialize('')).toBeNull();
    expect(adapter.deserialize('2026-11-03')).toBe('2026-11-03');
    expect(adapter.isValid(adapter.deserialize('x')!)).toBe(false);
    expect(adapter.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
