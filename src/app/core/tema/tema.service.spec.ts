import { TestBed } from '@angular/core/testing';
import { Tema } from './tema.service';

describe('Tema', () => {
  const matchMediaOriginal = Object.getOwnPropertyDescriptor(window, 'matchMedia');

  function simularPreferenciaDoSistema(escuro: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: escuro }) as MediaQueryList),
    });
  }

  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('tema-escuro');
  });

  afterEach(() => {
    if (matchMediaOriginal) {
      Object.defineProperty(window, 'matchMedia', matchMediaOriginal);
    } else {
      delete (window as Partial<Window>).matchMedia;
    }
    localStorage.clear();
  });

  it('deve seguir a preferência do sistema quando não houver escolha salva', () => {
    simularPreferenciaDoSistema(true);

    expect(TestBed.inject(Tema).escuro()).toBe(true);
  });

  it('deve priorizar a escolha salva no navegador', () => {
    simularPreferenciaDoSistema(true);
    localStorage.setItem('painel-tema', 'claro');

    expect(TestBed.inject(Tema).escuro()).toBe(false);
  });

  it('deve alternar o tema, aplicar a classe no body e salvar a escolha', () => {
    simularPreferenciaDoSistema(false);
    const tema = TestBed.inject(Tema);

    tema.alternar();
    TestBed.tick();

    expect(document.body.classList.contains('tema-escuro')).toBe(true);
    expect(localStorage.getItem('painel-tema')).toBe('escuro');
  });
});
