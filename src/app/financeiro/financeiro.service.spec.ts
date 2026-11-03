import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { FiltroContas } from './financeiro.model';
import { FinanceiroService } from './financeiro.service';

describe('FinanceiroService', () => {
  const url = `${environment.apiUrl}/financeiro`;
  const semFiltro: FiltroContas = { situacao: 'TODAS', busca: '', vencimentoDe: '', vencimentoAte: '' };
  let service: FinanceiroService;
  let controle: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FinanceiroService);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  function listar(tipo: 'contas-pagar' | 'contas-receber', filtro: Partial<FiltroContas>): string {
    service.listar(tipo, { ...semFiltro, ...filtro }, 1, 20).subscribe();
    const req = controle.expectOne((r) => r.url === `${url}/${tipo}`);
    req.flush({ conteudo: [], pagina: 1, tamanho: 20, totalElementos: 0, totalPaginas: 0 });
    return req.request.params.toString();
  }

  it('deve traduzir a situação escolhida nos parâmetros da API', () => {
    expect(listar('contas-pagar', {})).toBe('page=1&size=20');
    expect(listar('contas-pagar', { situacao: 'PENDENTE' })).toBe('page=1&size=20&status=PENDENTE');
    expect(listar('contas-pagar', { situacao: 'VENCIDAS' })).toBe('page=1&size=20&vencidas=true');
    expect(listar('contas-pagar', { situacao: 'QUITADA' })).toBe('page=1&size=20&status=PAGO');
    expect(listar('contas-receber', { situacao: 'QUITADA' })).toBe('page=1&size=20&status=RECEBIDO');
    expect(listar('contas-receber', { situacao: 'CANCELADO' })).toBe('page=1&size=20&status=CANCELADO');
  });

  it('deve enviar busca e período só quando preenchidos', () => {
    expect(listar('contas-pagar', { busca: '  aluguel ', vencimentoDe: '2026-11-01', vencimentoAte: '2026-11-30' })).toBe(
      'page=1&size=20&busca=aluguel&vencimentoDe=2026-11-01&vencimentoAte=2026-11-30',
    );
  });

  it('deve buscar o resumo, lançar, editar, dar baixa, cancelar e excluir', () => {
    service.resumo().subscribe();
    controle.expectOne(`${url}/resumo`).flush({});

    const dados = {
      descricao: 'Aluguel',
      pessoa: 'Imobiliária Exemplo',
      documento: null,
      categoria: null,
      valor: 2500,
      percentualImposto: 0,
      vencimento: '2026-11-10',
      formaPagamento: 'BOLETO' as const,
      chavePix: null,
      observacoes: null,
    };
    service.criar('contas-pagar', dados).subscribe();
    const criacao = controle.expectOne(`${url}/contas-pagar`);
    expect(criacao.request.method).toBe('POST');
    expect(criacao.request.body).toEqual(dados);
    criacao.flush({});

    service.atualizar('contas-pagar', 'c1', dados).subscribe();
    expect(controle.expectOne(`${url}/contas-pagar/c1`).request.method).toBe('PUT');

    service.baixar('contas-receber', 'c2', '2026-11-03').subscribe();
    const baixa = controle.expectOne(`${url}/contas-receber/c2/baixa`);
    expect(baixa.request.method).toBe('PATCH');
    expect(baixa.request.body).toEqual({ data: '2026-11-03' });

    service.cancelar('contas-pagar', 'c1').subscribe();
    expect(controle.expectOne(`${url}/contas-pagar/c1/cancelamento`).request.method).toBe('PATCH');

    service.excluir('contas-pagar', 'c1').subscribe();
    expect(controle.expectOne(`${url}/contas-pagar/c1`).request.method).toBe('DELETE');
  });
});
