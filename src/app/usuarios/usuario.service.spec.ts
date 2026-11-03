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

  it('deve editar o usuário com PUT, enviando papel e acessos', () => {
    const dados = { nome: 'Maria', email: 'maria@exemplo.com', papel: 'USUARIO' as const, acessos: ['dashboard'] };
    service.atualizar('u1', dados).subscribe();
    const req = controle.expectOne(`${url}/u1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(dados);
    req.flush({});
  });

  it('deve redefinir a senha com PUT em /senha', () => {
    service.redefinirSenha('u1', 'novaSenha1').subscribe();
    const req = controle.expectOne(`${url}/u1/senha`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ senha: 'novaSenha1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
