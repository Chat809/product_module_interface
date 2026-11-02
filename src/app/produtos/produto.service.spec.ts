import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { Produto, ProdutoRequest } from './produto.model';
import { ProdutoService } from './produto.service';

describe('ProdutoService', () => {
  const url = `${environment.apiUrl}/produtos`;
  const request: ProdutoRequest = {
    nome: 'Teclado',
    descricao: 'Mecânico',
    preco: 349.9,
    quantidadeEmEstoque: 25,
  };
  const produto: Produto = { id: 1, ...request };

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

  it('deve listar os produtos com GET', () => {
    let resposta: Produto[] | undefined;
    service.listar().subscribe((produtos) => (resposta = produtos));

    const req = http.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush([produto]);

    expect(resposta).toEqual([produto]);
  });

  it('deve buscar um produto pelo id com GET', () => {
    let resposta: Produto | undefined;
    service.buscarPorId(1).subscribe((p) => (resposta = p));

    const req = http.expectOne(`${url}/1`);
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

  it('deve atualizar um produto com PUT', () => {
    service.atualizar(1, request).subscribe();

    const req = http.expectOne(`${url}/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush(produto);
  });

  it('deve remover um produto com DELETE', () => {
    service.remover(1).subscribe();

    const req = http.expectOne(`${url}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
