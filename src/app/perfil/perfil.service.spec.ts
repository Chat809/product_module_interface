import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { SEM_AVISO_DE_ERRO } from '../core/http/error.interceptor';
import { PerfilService } from './perfil.service';

describe('PerfilService', () => {
  const url = `${environment.apiUrl}/usuarios/me`;
  let service: PerfilService;
  let controle: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PerfilService);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  it('deve buscar o perfil, em silêncio só quando pedido', () => {
    service.buscar().subscribe();
    const normal = controle.expectOne(url);
    expect(normal.request.method).toBe('GET');
    expect(normal.request.context.get(SEM_AVISO_DE_ERRO)).toBe(false);
    normal.flush({});

    service.buscar(true).subscribe();
    expect(controle.expectOne(url).request.context.get(SEM_AVISO_DE_ERRO)).toBe(true);
  });

  it('deve salvar os dados pessoais com PUT', () => {
    const dados = { nome: 'Maria', telefone: '(11) 91234-5678', funcao: null, bio: null };
    service.atualizar(dados).subscribe();
    const req = controle.expectOne(url);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(dados);
    req.flush({});
  });

  it('deve enviar a foto como multipart no campo "arquivo" e removê-la com DELETE', () => {
    const arquivo = new File(['x'], 'foto.png', { type: 'image/png' });
    service.enviarAvatar(arquivo).subscribe();
    const envio = controle.expectOne(`${url}/avatar`);
    expect(envio.request.method).toBe('PUT');
    expect((envio.request.body as FormData).get('arquivo')).toBe(arquivo);
    envio.flush({});

    service.removerAvatar().subscribe();
    expect(controle.expectOne(`${url}/avatar`).request.method).toBe('DELETE');
  });
});
