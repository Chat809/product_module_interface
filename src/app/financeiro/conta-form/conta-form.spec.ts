import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Conta } from '../financeiro.model';
import { FinanceiroService } from '../financeiro.service';
import { ContaFormData, ContaFormDialog } from './conta-form';

const conta: Conta = {
  id: 'c1',
  descricao: 'Aluguel',
  pessoa: 'Imobiliária Exemplo',
  documento: null,
  categoria: 'Aluguel',
  valor: 2500,
  percentualImposto: 6.5,
  valorImposto: 162.5,
  valorLiquido: 2337.5,
  vencimento: '2026-11-10',
  dataBaixa: null,
  status: 'PENDENTE',
  vencida: false,
  formaPagamento: 'BOLETO',
  chavePix: null,
  observacoes: null,
  criadoPor: null,
  criadoEm: null,
  atualizadoEm: null,
};

describe('ContaFormDialog', () => {
  let fixture: ComponentFixture<ContaFormDialog>;
  let component: ContaFormDialog;
  let service: Record<'criar' | 'atualizar', ReturnType<typeof vi.fn>>;
  let fechar: ReturnType<typeof vi.fn>;

  async function criar(data: ContaFormData): Promise<void> {
    TestBed.configureTestingModule({
      imports: [ContaFormDialog],
      providers: [
        { provide: FinanceiroService, useValue: service },
        { provide: MatDialogRef, useValue: { close: fechar } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    fixture = TestBed.createComponent(ContaFormDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(() => {
    service = { criar: vi.fn(() => of(conta)), atualizar: vi.fn(() => of(conta)) };
    fechar = vi.fn();
  });

  it('deve mostrar a prévia de imposto e líquido enquanto o valor é digitado', async () => {
    await criar({ tipo: 'contas-pagar' });
    expect(component['calculo']()).toBeNull();

    component['form'].patchValue({ valor: 2500, percentualImposto: 6.5 });
    await fixture.whenStable();
    expect(component['calculo']()).toEqual({ imposto: 162.5, liquido: 2337.5 });
    expect(fixture.nativeElement.querySelector('.calculo').textContent).toContain('Sai do caixa');
  });

  it('deve exigir a chave Pix só quando a forma for Pix', async () => {
    await criar({ tipo: 'contas-receber' });
    component['form'].patchValue({ descricao: 'Venda', pessoa: 'Cliente Exemplo', valor: 100, vencimento: '2026-11-10' });
    component['salvar']();
    expect(service.criar).not.toHaveBeenCalled();
    expect(component['mensagemDeErro']('chavePix')).toBe('Informe a chave Pix');

    component['form'].patchValue({ formaPagamento: 'DINHEIRO' });
    component['salvar']();
    expect(service.criar).toHaveBeenCalledWith('contas-receber', {
      descricao: 'Venda',
      pessoa: 'Cliente Exemplo',
      documento: null,
      categoria: null,
      valor: 100,
      percentualImposto: 0,
      vencimento: '2026-11-10',
      formaPagamento: 'DINHEIRO',
      chavePix: null,
      observacoes: null,
    });
    expect(fechar).toHaveBeenCalledWith(conta);
  });

  it('deve descartar a chave digitada quando a forma deixar de ser Pix', async () => {
    await criar({ tipo: 'contas-pagar', conta });
    expect(component['form'].controls.chavePix.valid).toBe(true);

    component['form'].patchValue({ formaPagamento: 'PIX', chavePix: 'financeiro@exemplo.com' });
    component['form'].patchValue({ formaPagamento: 'TRANSFERENCIA' });
    component['salvar']();

    expect(service.atualizar).toHaveBeenCalledWith(
      'contas-pagar',
      'c1',
      expect.objectContaining({ formaPagamento: 'TRANSFERENCIA', chavePix: null }),
    );
  });

  it('deve validar valor e percentual com as regras da API', async () => {
    await criar({ tipo: 'contas-pagar' });
    component['form'].patchValue({ valor: 0, percentualImposto: 120 });
    expect(component['mensagemDeErro']('valor')).toBe('O valor deve ser maior que zero');
    expect(component['mensagemDeErro']('percentualImposto')).toBe('O imposto deve ser no máximo 100%');

    component['form'].patchValue({ valor: 10.999 });
    expect(component['mensagemDeErro']('valor')).toBe('Use até 12 dígitos inteiros e 2 casas decimais');
  });
});
