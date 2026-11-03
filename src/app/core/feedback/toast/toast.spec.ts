import { TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { Toast, ToastData } from './toast';

describe('Toast', () => {
  function renderizar(data: ToastData) {
    const ref = { dismiss: vi.fn() };
    TestBed.configureTestingModule({
      imports: [Toast],
      providers: [
        { provide: MAT_SNACK_BAR_DATA, useValue: data },
        { provide: MatSnackBarRef, useValue: ref },
      ],
    });
    const fixture = TestBed.createComponent(Toast);
    fixture.detectChanges();
    return { elemento: fixture.nativeElement as HTMLElement, ref };
  }

  it('deve exibir o emoji do tipo e a mensagem', () => {
    const { elemento } = renderizar({ tipo: 'sucesso', mensagem: 'Produto salvo.' });

    expect(elemento.querySelector('.emoji')?.textContent).toBe('✅');
    expect(elemento.querySelector('.mensagem')?.textContent).toBe('Produto salvo.');
    expect(elemento.querySelector('[role="status"]')).not.toBeNull();
  });

  it('deve fechar ao clicar no botão X', () => {
    const { elemento, ref } = renderizar({ tipo: 'erro', mensagem: 'Falhou.' });

    const botao = elemento.querySelector<HTMLButtonElement>('button[aria-label="Fechar aviso"]');
    expect(botao?.textContent).not.toContain('Fechar');
    botao?.click();

    expect(ref.dismiss).toHaveBeenCalled();
    expect(elemento.querySelector('[role="alert"]')).not.toBeNull();
  });
});
