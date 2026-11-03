import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { BaixaDialog } from '../baixa-dialog/baixa-dialog';
import { ContaFormDialog } from '../conta-form/conta-form';
import { Conta } from '../financeiro.model';
import { FinanceiroService } from '../financeiro.service';
import { ContaLista } from './conta-lista';

function conta(id: string, extra: Partial<Conta> = {}): Conta {
  return {
    id,
    descricao: `Conta ${id}`,
    pessoa: 'Fornecedor Exemplo',
    documento: null,
    categoria: null,
    valor: 1000,
    percentualImposto: 10,
    valorImposto: 100,
    valorLiquido: 900,
    vencimento: '2026-11-10',
    dataBaixa: null,
    status: 'PENDENTE',
    vencida: false,
    formaPagamento: 'PIX',
    chavePix: 'chave@exemplo.com',
    observacoes: null,
    criadoPor: null,
    criadoEm: null,
    atualizadoEm: null,
    ...extra,
  };
}

describe('ContaLista', () => {
  let fixture: ComponentFixture<ContaLista>;
  let component: ContaLista;
  let elemento: HTMLElement;
  let service: Record<'listar' | 'cancelar' | 'excluir', ReturnType<typeof vi.fn>>;
  let abrir: ReturnType<typeof vi.fn>;
  let resultadoDoDialogo: unknown;
  let notificacao: { sucesso: ReturnType<typeof vi.fn> };
  let alterou: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(async () => {
    service = {
      listar: vi.fn(() =>
        of({
          conteudo: [conta('1'), conta('2', { vencida: true }), conta('3', { status: 'PAGO', dataBaixa: '2026-11-02' })],
          pagina: 0,
          tamanho: 20,
          totalElementos: 3,
          totalPaginas: 1,
        }),
      ),
      cancelar: vi.fn(() => of(conta('1', { status: 'CANCELADO' }))),
      excluir: vi.fn(() => of(undefined)),
    };
    resultadoDoDialogo = undefined;
    abrir = vi.fn(() => ({ afterClosed: () => of(resultadoDoDialogo) }));
    notificacao = { sucesso: vi.fn() };
    alterou = vi.fn<() => void>();

    TestBed.configureTestingModule({
      imports: [ContaLista],
      providers: [
        { provide: FinanceiroService, useValue: service },
        { provide: Notificacao, useValue: notificacao },
        { provide: MatDialog, useValue: { open: abrir } },
      ],
    });
    fixture = TestBed.createComponent(ContaLista);
    fixture.componentRef.setInput('tipo', 'contas-pagar');
    component = fixture.componentInstance;
    component.alterou.subscribe(() => alterou());
    elemento = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('deve abrir nas pendentes e mostrar valor, imposto, líquido e situação', () => {
    expect(service.listar).toHaveBeenCalledWith(
      'contas-pagar',
      { situacao: 'PENDENTE', busca: '', vencimentoDe: '', vencimentoAte: '' },
      0,
      20,
    );
    const linhas = Array.from(elemento.querySelectorAll('tr.mat-mdc-row')).map((tr) =>
      tr.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(linhas[0]).toContain('Fornecedor Exemplo');
    expect(linhas[0]).toContain('Pix');
    expect(linhas[0]).toContain('(10%)');
    expect(linhas[0]).toContain('Pendente');
    expect(linhas[1]).toContain('Vencida');
    expect(linhas[2]).toContain('Paga');
    expect(elemento.querySelector('th.mat-mdc-header-cell:nth-child(3)')?.textContent).toContain('Favorecido');
  });

  it('deve voltar à primeira página ao trocar o filtro', () => {
    component['mudarPagina']({ pageIndex: 2, pageSize: 50, length: 200 });
    expect(service.listar).toHaveBeenLastCalledWith('contas-pagar', expect.anything(), 2, 50);

    component['filtrar']({ situacao: 'VENCIDAS' });
    expect(service.listar).toHaveBeenLastCalledWith(
      'contas-pagar',
      expect.objectContaining({ situacao: 'VENCIDAS' }),
      0,
      50,
    );
  });

  it('deve esperar a digitação antes de buscar', async () => {
    vi.useFakeTimers();
    try {
      component['digitarBusca']('alu');
      component['digitarBusca']('aluguel');
      expect(service.listar).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(300);
      expect(service.listar).toHaveBeenCalledTimes(2);
      expect(service.listar).toHaveBeenLastCalledWith('contas-pagar', expect.objectContaining({ busca: 'aluguel' }), 0, 20);
    } finally {
      vi.useRealTimers();
    }
  });

  it('deve lançar, dar baixa, cancelar e excluir, recarregando a lista e o resumo', () => {
    resultadoDoDialogo = conta('novo');
    component['nova']();
    expect(abrir).toHaveBeenCalledWith(ContaFormDialog, expect.objectContaining({ data: { tipo: 'contas-pagar', conta: undefined } }));
    expect(notificacao.sucesso).toHaveBeenCalledWith('Conta lançada.');

    component['darBaixa'](conta('1'));
    expect(abrir).toHaveBeenLastCalledWith(BaixaDialog, expect.objectContaining({ data: { tipo: 'contas-pagar', conta: conta('1') } }));
    expect(notificacao.sucesso).toHaveBeenCalledWith('Paga: Conta 1.');

    resultadoDoDialogo = true;
    component['cancelar'](conta('1'));
    expect(service.cancelar).toHaveBeenCalledWith('contas-pagar', '1');

    component['excluir'](conta('2'));
    expect(service.excluir).toHaveBeenCalledWith('contas-pagar', '2');

    expect(alterou).toHaveBeenCalledTimes(4);
    expect(service.listar).toHaveBeenCalledTimes(5);
  });

  it('não deve fazer nada quando a confirmação for recusada', () => {
    resultadoDoDialogo = false;
    component['excluir'](conta('1'));
    expect(service.excluir).not.toHaveBeenCalled();
    expect(alterou).not.toHaveBeenCalled();
  });

  it('deve exibir o estado de erro quando a primeira carga falhar', async () => {
    service.listar.mockReturnValue(throwError(() => new Error('falha')));
    component['carregouUmaVez'].set(false);
    component['carregar']();
    await fixture.whenStable();
    expect(elemento.textContent).toContain('Não foi possível carregar as contas');
  });
});
