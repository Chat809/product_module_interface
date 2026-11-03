import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Notificacao } from '../feedback/notificacao.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controle: HttpTestingController;
  let notificacao: Record<'erro' | 'aviso', ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    notificacao = { erro: vi.fn(), aviso: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: Notificacao, useValue: notificacao },
      ],
    });
    http = TestBed.inject(HttpClient);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  function falhar(status: number, corpo: object | null = null): unknown {
    let erroRecebido: unknown;
    http.get('/api').subscribe({ error: (e) => (erroRecebido = e) });
    const req = controle.expectOne('/api');
    if (status === 0) {
      req.error(new ProgressEvent('error'), { status: 0 });
    } else {
      req.flush(corpo, { status, statusText: 'Erro' });
    }
    return erroRecebido;
  }

  it('deve avisar quando não conseguir conectar à API', () => {
    falhar(0);
    expect(notificacao.erro).toHaveBeenCalledWith(expect.stringContaining('Não foi possível conectar'));
  });

  it('deve pedir para revisar os campos em erro de validação', () => {
    falhar(400, { erros: [{ campo: 'nome', mensagem: 'obrigatório' }] });
    expect(notificacao.erro).toHaveBeenCalledWith('Verifique os campos destacados no formulário.');
  });

  it('deve exibir o detalhe da API em 400 sem erros por campo', () => {
    falhar(400, { detail: "O parâmetro 'size' deve estar entre 1 e 500" });
    expect(notificacao.erro).toHaveBeenCalledWith("O parâmetro 'size' deve estar entre 1 e 500");
  });

  it('deve avisar sobre edição concorrente em 409', () => {
    falhar(409);
    expect(notificacao.aviso).toHaveBeenCalledWith(expect.stringContaining('alterado por outra pessoa'));
  });

  it('deve exibir o detalhe da regra de negócio em 422', () => {
    falhar(422, { detail: 'Estoque insuficiente' });
    expect(notificacao.aviso).toHaveBeenCalledWith('Estoque insuficiente');
  });

  it('deve usar uma mensagem genérica quando a API não enviar detalhe e repassar o erro', () => {
    const erro = falhar(500);
    expect(notificacao.erro).toHaveBeenCalledWith('Ocorreu um erro inesperado. Tente novamente.');
    expect(erro).toBeDefined();
  });
});
