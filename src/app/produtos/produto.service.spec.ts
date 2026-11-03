import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { Pagina, Produto, ProdutoRequest, ResumoEstoque } from './produto.model';
import { ProdutoService, TAMANHO_CATALOGO } from './produto.service';

describe('ProdutoService', () => {
  const url = `${environment.apiUrl}/produtos`;
  const id = '3f1c2b4e-8a6d-4e2f-9b1a-0c5d7e8f9a10';
  const request: ProdutoRequest = {
    nome: 'Teclado',
    descricao: 'Mecânico',
    preco: 349.9,
    quantidadeEmEstoque: 25,
  };
  const produto: Produto = {
    id,
    ...request,
    criadoEm: '2026-11-01T10:00:00Z',
    atualizadoEm: '2026-11-01T10:00:00Z',
    versao: 0,
  };

  let service: ProdutoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProdutoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deve carregar o catálogo em uma única página ordenada por nome', () => {
    let resposta: Produto[] | undefined;
    service.listarCatalogo().subscribe((produtos) => (resposta = produtos));

    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('size')).toBe(String(TAMANHO_CATALOGO));
    expect(req.request.params.get('sort')).toBe('nome,asc');
    const pagina: Pagina<Produto> = {
      conteudo: [produto],
      pagina: 0,
      tamanho: TAMANHO_CATALOGO,
      totalElementos: 1,
      totalPaginas: 1,
    };
    req.flush(pagina);

    expect(resposta).toEqual([produto]);
  });

  it('deve buscar um produto pelo id com GET', () => {
    let resposta: Produto | undefined;
    service.buscarPorId(id).subscribe((p) => (resposta = p));

    const req = http.expectOne(`${url}/${id}`);
    expect(req.request.method).toBe('GET');
    req.flush(produto);

    expect(resposta).toEqual(produto);
  });

  it('deve criar um produto com POST enviando o corpo sem id', () => {
    service.criar(request).subscribe();

    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(produto);
  });

  it('deve atualizar um produto com PUT enviando a versão no corpo e no If-Match', () => {
    service.atualizar(id, { ...request, versao: 0 }).subscribe();

    const req = http.expectOne(`${url}/${id}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ...request, versao: 0 });
    expect(req.request.headers.get('If-Match')).toBe('"0"');
    req.flush(produto);
  });

  it('não deve enviar If-Match quando não houver versão', () => {
    service.atualizar(id, request).subscribe();

    const req = http.expectOne(`${url}/${id}`);
    expect(req.request.headers.has('If-Match')).toBe(false);
    req.flush(produto);
  });

  it('deve remover um produto com DELETE', () => {
    service.remover(id).subscribe();

    const req = http.expectOne(`${url}/${id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('deve registrar uma movimentação com POST', () => {
    service.movimentar(id, { tipo: 'SAIDA', quantidade: 3, motivo: 'Venda' }).subscribe();

    const req = http.expectOne(`${url}/${id}/movimentacoes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tipo: 'SAIDA', quantidade: 3, motivo: 'Venda' });
    req.flush({});
  });

  it('deve buscar o histórico de movimentações paginado', () => {
    service.historico(id, 10).subscribe();

    const req = http.expectOne((r) => r.url === `${url}/${id}/movimentacoes`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ conteudo: [], pagina: 0, tamanho: 10, totalElementos: 0, totalPaginas: 0 });
  });

  it('deve buscar o resumo do estoque', () => {
    let resposta: ResumoEstoque | undefined;
    service.resumo().subscribe((r) => (resposta = r));

    const resumo: ResumoEstoque = {
      totalProdutos: 15,
      totalItens: 216,
      valorTotal: 118132.3,
      esgotados: 2,
      estoqueBaixo: 5,
      limiteEstoqueBaixo: 5,
    };
    http.expectOne(`${url}/resumo`).flush(resumo);

    expect(resposta).toEqual(resumo);
  });
});
