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

  it('deve editar o usuário com PUT, enviando nível, acessos, departamento e cargo', () => {
    const dados = {
      nome: 'Maria',
      email: 'maria@exemplo.com',
      papel: 'USUARIO' as const,
      acessos: ['dashboard'],
      departamento: 'Compras',
      funcao: 'Compradora',
    };
    service.atualizar('u1', dados).subscribe();
    const req = controle.expectOne(`${url}/u1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(dados);
    req.flush({});
  });

  it('deve criar o usuário com POST, enviando a senha inicial', () => {
    const dados = {
      nome: 'Carla',
      email: 'carla@exemplo.com',
      senha: 'segredo1',
      papel: 'USUARIO' as const,
      acessos: ['dashboard'],
      departamento: null,
      funcao: null,
    };
    service.criar(dados).subscribe();
    const req = controle.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dados);
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('deve excluir o usuário com DELETE', () => {
    service.excluir('u1').subscribe();
    const req = controle.expectOne(`${url}/u1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('deve redefinir a senha com PUT em /senha', () => {
    service.redefinirSenha('u1', 'novaSenha1').subscribe();
    const req = controle.expectOne(`${url}/u1/senha`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ senha: 'novaSenha1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('deve enviar a foto de outra pessoa como multipart e removê-la com DELETE', () => {
    const arquivo = new File(['x'], 'foto.png', { type: 'image/png' });
    service.enviarAvatar('u1', arquivo).subscribe();
    const envio = controle.expectOne(`${url}/u1/avatar`);
    expect(envio.request.method).toBe('PUT');
    expect((envio.request.body as FormData).get('arquivo')).toBe(arquivo);
    envio.flush({});

    service.removerAvatar('u1').subscribe();
    const remocao = controle.expectOne(`${url}/u1/avatar`);
    expect(remocao.request.method).toBe('DELETE');
    remocao.flush({});
  });
});
