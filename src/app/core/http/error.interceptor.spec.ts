import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Notificacao } from '../feedback/notificacao.service';
import { SEM_AVISO_DE_ERRO, errorInterceptor } from './error.interceptor';

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

  function falhar(status: number, corpo: object | null = null, url = '/api'): unknown {
    let erroRecebido: unknown;
    http.get(url).subscribe({ error: (e) => (erroRecebido = e) });
    const req = controle.expectOne(url);
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

  it('deve avisar sobre edição concorrente em 409 nas rotas de produtos', () => {
    falhar(409, null, '/api/produtos/1');
    expect(notificacao.aviso).toHaveBeenCalledWith(expect.stringContaining('alterado por outra pessoa'));
  });

  it('deve exibir o detalhe da API em 409 fora dos produtos', () => {
    falhar(409, { detail: 'Já existe uma conta com o e-mail maria@exemplo.com' }, '/api/auth/registro');
    expect(notificacao.erro).toHaveBeenCalledWith('Já existe uma conta com o e-mail maria@exemplo.com');
  });

  it('deve exibir o motivo do 401 no login e avisar sobre sessão expirada nas demais rotas', () => {
    falhar(401, { detail: 'E-mail ou senha inválidos' }, '/api/auth/login');
    expect(notificacao.erro).toHaveBeenCalledWith('E-mail ou senha inválidos');

    falhar(401, null, '/api/produtos');
    expect(notificacao.aviso).toHaveBeenCalledWith('Sua sessão expirou. Entre novamente.');
  });

  it('deve avisar sobre falta de permissão em 403', () => {
    falhar(403);
    expect(notificacao.aviso).toHaveBeenCalledWith('Você não tem permissão para esta ação.');
  });

  it('deve exibir o detalhe da regra de negócio em 422', () => {
    falhar(422, { detail: 'Estoque insuficiente' });
    expect(notificacao.aviso).toHaveBeenCalledWith('Estoque insuficiente');
  });

  it('deve ficar em silêncio nas requisições marcadas como de segundo plano', () => {
    let erroRecebido: unknown;
    http
      .get('/api/usuarios/me', { context: new HttpContext().set(SEM_AVISO_DE_ERRO, true) })
      .subscribe({ error: (e) => (erroRecebido = e) });
    controle.expectOne('/api/usuarios/me').flush(null, { status: 503, statusText: 'Erro' });

    expect(erroRecebido).toBeDefined();
    expect(notificacao.erro).not.toHaveBeenCalled();
  });

  it('deve exibir o limite de tamanho em 413', () => {
    falhar(413, { detail: 'A imagem deve ter no máximo 2 MB' });
    expect(notificacao.erro).toHaveBeenCalledWith('A imagem deve ter no máximo 2 MB');
  });

  it('deve usar uma mensagem genérica quando a API não enviar detalhe e repassar o erro', () => {
    const erro = falhar(500);
    expect(notificacao.erro).toHaveBeenCalledWith('Ocorreu um erro inesperado. Tente novamente.');
    expect(erro).toBeDefined();
  });
});
