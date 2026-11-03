import { Injectable, Provider, inject } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatDateFormats } from '@angular/material/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIGITADA = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const INVALIDA = 'invalida';

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/**
 * Datas do datepicker como texto ISO (`2026-11-03`), o mesmo formato dos formulários e da API, sem fuso:
 * evita que um `Date` à meia-noite vire o dia anterior. Na tela aparece e se digita `dd/mm/aaaa`.
 */
@Injectable()
export class DataIsoAdapter extends DateAdapter<string> {
  constructor() {
    super();
    this.setLocale(inject(MAT_DATE_LOCALE, { optional: true }) ?? 'pt-BR');
  }

  getYear(data: string): number {
    return Number(data.slice(0, 4));
  }

  getMonth(data: string): number {
    return Number(data.slice(5, 7)) - 1;
  }

  getDate(data: string): number {
    return Number(data.slice(8, 10));
  }

  getDayOfWeek(data: string): number {
    return this.utc(data).getUTCDay();
  }

  getMonthNames(estilo: 'long' | 'short' | 'narrow'): string[] {
    const formato = new Intl.DateTimeFormat(this.locale, { month: estilo, timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, mes) => formato.format(Date.UTC(2017, mes, 1)));
  }

  getDateNames(): string[] {
    return Array.from({ length: 31 }, (_, i) => String(i + 1));
  }

  /** 1º de janeiro de 2017 foi um domingo. */
  getDayOfWeekNames(estilo: 'long' | 'short' | 'narrow'): string[] {
    const formato = new Intl.DateTimeFormat(this.locale, { weekday: estilo, timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, dia) => formato.format(Date.UTC(2017, 0, dia + 1)));
  }

  getYearName(data: string): string {
    return String(this.getYear(data));
  }

  getFirstDayOfWeek(): number {
    return 0;
  }

  getNumDaysInMonth(data: string): number {
    return new Date(Date.UTC(this.getYear(data), this.getMonth(data) + 1, 0)).getUTCDate();
  }

  clone(data: string): string {
    return data;
  }

  createDate(ano: number, mes: number, dia: number): string {
    const data = new Date(Date.UTC(ano, mes, dia));
    if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes || data.getUTCDate() !== dia) {
      throw new Error(`Data inválida: ${dia}/${mes + 1}/${ano}`);
    }
    return this.paraIso(data);
  }

  today(): string {
    const agora = new Date();
    return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
  }

  /** Aceita `dd/mm/aaaa` (digitado) e `aaaa-mm-dd` (colado ou vindo da API). */
  parse(valor: unknown): string | null {
    if (typeof valor !== 'string' || !valor.trim()) {
      return null;
    }
    const texto = valor.trim();
    if (ISO.test(texto)) {
      return this.isValid(texto) ? texto : this.invalid();
    }
    const digitada = DIGITADA.exec(texto);
    if (!digitada) {
      return this.invalid();
    }
    const [, dia, mes, ano] = digitada;
    const iso = `${ano}-${doisDigitos(Number(mes))}-${doisDigitos(Number(dia))}`;
    return this.isValid(iso) ? iso : this.invalid();
  }

  format(data: string, formato: Intl.DateTimeFormatOptions): string {
    if (!this.isValid(data)) {
      throw new Error('DataIsoAdapter: não é possível formatar uma data inválida');
    }
    return new Intl.DateTimeFormat(this.locale, { ...formato, timeZone: 'UTC' }).format(this.utc(data));
  }

  addCalendarYears(data: string, anos: number): string {
    return this.addCalendarMonths(data, anos * 12);
  }

  /** Como no adaptador nativo: 31/01 + 1 mês vira o último dia de fevereiro. */
  addCalendarMonths(data: string, meses: number): string {
    const total = this.getYear(data) * 12 + this.getMonth(data) + meses;
    const ano = Math.floor(total / 12);
    const mes = total - ano * 12;
    const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    return this.paraIso(new Date(Date.UTC(ano, mes, Math.min(this.getDate(data), ultimoDia))));
  }

  addCalendarDays(data: string, dias: number): string {
    return this.paraIso(new Date(Date.UTC(this.getYear(data), this.getMonth(data), this.getDate(data) + dias)));
  }

  toIso8601(data: string): string {
    return data;
  }

  override deserialize(valor: unknown): string | null {
    if (valor === '' || valor == null) {
      return null;
    }
    return typeof valor === 'string' && this.isValid(valor) ? valor : this.invalid();
  }

  isDateInstance(valor: unknown): boolean {
    return typeof valor === 'string';
  }

  isValid(data: string): boolean {
    const partes = ISO.exec(data);
    if (!partes) {
      return false;
    }
    const [, ano, mes, dia] = partes.map(Number);
    const utc = new Date(Date.UTC(ano, mes - 1, dia));
    return utc.getUTCFullYear() === ano && utc.getUTCMonth() === mes - 1 && utc.getUTCDate() === dia;
  }

  invalid(): string {
    return INVALIDA;
  }

  private utc(data: string): Date {
    return new Date(Date.UTC(this.getYear(data), this.getMonth(data), this.getDate(data)));
  }

  private paraIso(data: Date): string {
    return `${data.getUTCFullYear()}-${doisDigitos(data.getUTCMonth() + 1)}-${doisDigitos(data.getUTCDate())}`;
  }
}

@Injectable()
export class CalendarioIntl extends MatDatepickerIntl {
  override calendarLabel = 'Calendário';
  override openCalendarLabel = 'Abrir calendário';
  override closeCalendarLabel = 'Fechar calendário';
  override prevMonthLabel = 'Mês anterior';
  override nextMonthLabel = 'Próximo mês';
  override prevYearLabel = 'Ano anterior';
  override nextYearLabel = 'Próximo ano';
  override prevMultiYearLabel = 'Anos anteriores';
  override nextMultiYearLabel = 'Próximos anos';
  override switchToMonthViewLabel = 'Escolher dia';
  override switchToMultiYearViewLabel = 'Escolher mês e ano';
}

export const FORMATOS_DE_DATA: MatDateFormats = {
  parse: { dateInput: null },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthLabel: { month: 'short' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' },
  },
};

/**
 * Datepickers do painel em português, com valores ISO (`aaaa-mm-dd`). Vai nos `providers` de cada componente
 * com calendário, para não pesar no carregamento inicial nem depender do injetor dos diálogos.
 */
export const PROVEDORES_DE_DATA: Provider[] = [
  { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
  { provide: DateAdapter, useClass: DataIsoAdapter },
  { provide: MAT_DATE_FORMATS, useValue: FORMATOS_DE_DATA },
  { provide: MatDatepickerIntl, useClass: CalendarioIntl },
];
