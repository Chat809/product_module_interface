import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { DemandaRequest } from './demanda.model';
import { DemandaService } from './demanda.service';

describe('DemandaService', () => {
  const url = `${environment.apiUrl}/demandas`;
  let service: DemandaService;
  let controle: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DemandaService);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  it('deve listar todas ou só as abertas de um responsável', () => {
    service.listar().subscribe();
    controle.expectOne(url).flush([]);

    service.listar({ responsavel: 'me', abertas: true }).subscribe();
    controle.expectOne(`${url}?responsavel=me&abertas=true`).flush([]);
  });

  it('deve criar, editar e excluir', () => {
    const dados: DemandaRequest = {
      titulo: 'Revisar estoque',
      descricao: null,
      tipo: 'TAREFA',
      urgencia: 'ALTA',
      status: 'A_FAZER',
      prazo: '2026-11-20',
      responsaveis: ['u1'],
      checklist: [{ texto: 'Contar', feito: false }],
    };
    service.criar(dados).subscribe();
    const criacao = controle.expectOne(url);
    expect(criacao.request.method).toBe('POST');
    expect(criacao.request.body).toEqual(dados);
    criacao.flush({});

    service.atualizar('d1', dados).subscribe();
    expect(controle.expectOne(`${url}/d1`).request.method).toBe('PUT');

    service.excluir('d1').subscribe();
    expect(controle.expectOne(`${url}/d1`).request.method).toBe('DELETE');
  });

  it('deve mover com PATCH em /status, levando status e posição', () => {
    service.mover('d1', 'EM_REVISAO', 2).subscribe();
    const req = controle.expectOne(`${url}/d1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'EM_REVISAO', posicao: 2 });
    req.flush({});
  });

  it('deve buscar os responsáveis possíveis em /usuarios/opcoes', () => {
    service.responsaveis().subscribe();
    controle.expectOne(`${environment.apiUrl}/usuarios/opcoes`).flush([]);
  });
});
