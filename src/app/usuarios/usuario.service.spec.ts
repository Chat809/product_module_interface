import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { UsuarioService } from './usuario.service';

describe('UsuarioService', () => {
  const url = `${environment.apiUrl}/usuarios`;
  let service: UsuarioService;
  let controle: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UsuarioService);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  it('deve listar a página pedida', () => {
    service.listar(2, 25).subscribe();
    const req = controle.expectOne(`${url}?page=2&size=25`);
    expect(req.request.method).toBe('GET');
    req.flush({ conteudo: [], pagina: 2, tamanho: 25, totalElementos: 0, totalPaginas: 0 });
  });

  it('deve alterar o papel com PATCH', () => {
    service.alterarPapel('u1', 'ADMIN').subscribe();
    const req = controle.expectOne(`${url}/u1/papel`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ papel: 'ADMIN' });
    req.flush({});
  });
});
