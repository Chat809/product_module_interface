import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Conta, hojeIso } from '../financeiro.model';
import { FinanceiroService } from '../financeiro.service';
import { BaixaDialog } from './baixa-dialog';

describe('BaixaDialog', () => {
  const conta = { id: 'c1', descricao: 'Venda', pessoa: 'Cliente', valorLiquido: 90 } as Conta;
  let baixar: ReturnType<typeof vi.fn>;
  let fechar: ReturnType<typeof vi.fn>;
  let component: BaixaDialog;

  beforeEach(async () => {
    baixar = vi.fn(() => of({ ...conta, status: 'RECEBIDO' }));
    fechar = vi.fn();
    TestBed.configureTestingModule({
      imports: [BaixaDialog],
      providers: [
        { provide: FinanceiroService, useValue: { baixar } },
        { provide: MatDialogRef, useValue: { close: fechar } },
        { provide: MAT_DIALOG_DATA, useValue: { tipo: 'contas-receber', conta } },
      ],
    });
    const fixture = TestBed.createComponent(BaixaDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Registrar recebimento');
  });

  it('deve sugerir hoje e registrar a baixa com a data escolhida', () => {
    expect(component['form'].controls.data.value).toBe(hojeIso());
    component['form'].controls.data.setValue('2026-11-01');
    component['confirmar']();

    expect(baixar).toHaveBeenCalledWith('contas-receber', 'c1', '2026-11-01');
    expect(fechar).toHaveBeenCalledWith(expect.objectContaining({ status: 'RECEBIDO' }));
  });

  it('não deve aceitar data futura nem vazia', () => {
    component['form'].controls.data.setValue('2999-01-01');
    component['confirmar']();
    component['form'].controls.data.setValue('');
    component['confirmar']();
    expect(baixar).not.toHaveBeenCalled();
  });
});
