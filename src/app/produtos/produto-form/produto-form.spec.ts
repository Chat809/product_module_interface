import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Produto } from '../produto.model';
import { ProdutoService } from '../produto.service';
import { ProdutoForm } from './produto-form';

describe('ProdutoForm', () => {
  const produto: Produto = {
    id: 1,
    nome: 'Teclado',
    descricao: 'Mecânico',
    preco: 349.9,
    quantidadeEmEstoque: 25,
  };

  let fixture: ComponentFixture<ProdutoForm>;
  let component: ProdutoForm;
  let produtoService: {
    buscarPorId: ReturnType<typeof vi.fn>;
    criar: ReturnType<typeof vi.fn>;
    atualizar: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(() => {
    produtoService = { buscarPorId: vi.fn(), criar: vi.fn(), atualizar: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ProdutoForm],
      providers: [provideRouter([]), { provide: ProdutoService, useValue: produtoService }],
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ProdutoForm);
    component = fixture.componentInstance;
  });

  function preencher(valores: Partial<Record<keyof Omit<Produto, 'id'>, unknown>>): void {
    component['form'].patchValue(valores as never);
  }

  it('não deve enviar o formulário quando houver campos inválidos', async () => {
    await fixture.whenStable();

    component['salvar']();

    expect(produtoService.criar).not.toHaveBeenCalled();
    expect(component['mensagemDeErro']('nome')).toBe('O nome é obrigatório');
    expect(component['mensagemDeErro']('preco')).toBe('O preço é obrigatório');
    expect(component['mensagemDeErro']('quantidadeEmEstoque')).toBe(
      'A quantidade em estoque é obrigatória',
    );
  });

  it('deve aplicar as mesmas regras de validação da API', async () => {
    await fixture.whenStable();

    preencher({ nome: '   ', preco: 0, quantidadeEmEstoque: -1 });
    expect(component['mensagemDeErro']('nome')).toBe('O nome é obrigatório');
    expect(component['mensagemDeErro']('preco')).toBe('O preço deve ser maior que zero');
    expect(component['mensagemDeErro']('quantidadeEmEstoque')).toBe(
      'A quantidade em estoque não pode ser negativa',
    );

    preencher({ preco: 10.999, quantidadeEmEstoque: 1.5 });
    expect(component['mensagemDeErro']('preco')).toBe(
      'Use no máximo 10 dígitos inteiros e 2 casas decimais',
    );
    expect(component['mensagemDeErro']('quantidadeEmEstoque')).toBe('Informe um número inteiro');
  });

  it('deve criar o produto e voltar para a lista', async () => {
    produtoService.criar.mockReturnValue(of(produto));
    await fixture.whenStable();

    preencher({ nome: 'Teclado', descricao: '', preco: 349.9, quantidadeEmEstoque: 25 });
    component['salvar']();

    expect(produtoService.criar).toHaveBeenCalledWith({
      nome: 'Teclado',
      descricao: null,
      preco: 349.9,
      quantidadeEmEstoque: 25,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/produtos']);
  });

  it('deve carregar o produto e atualizá-lo no modo edição', async () => {
    produtoService.buscarPorId.mockReturnValue(of(produto));
    produtoService.atualizar.mockReturnValue(of(produto));
    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();

    expect(produtoService.buscarPorId).toHaveBeenCalledWith(1);
    expect(component['form'].getRawValue()).toEqual({
      nome: 'Teclado',
      descricao: 'Mecânico',
      preco: 349.9,
      quantidadeEmEstoque: 25,
    });

    preencher({ quantidadeEmEstoque: 30 });
    component['salvar']();

    expect(produtoService.atualizar).toHaveBeenCalledWith(1, {
      nome: 'Teclado',
      descricao: 'Mecânico',
      preco: 349.9,
      quantidadeEmEstoque: 30,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/produtos']);
  });

  it('deve exibir no campo correspondente os erros de validação retornados pela API', async () => {
    const erroDaApi = new HttpErrorResponse({
      status: 400,
      error: {
        title: 'Dados inválidos',
        erros: [{ campo: 'nome', mensagem: 'Nome rejeitado pela API' }],
      },
    });
    produtoService.criar.mockReturnValue(throwError(() => erroDaApi));
    await fixture.whenStable();

    preencher({ nome: 'Teclado', preco: 10, quantidadeEmEstoque: 1 });
    component['salvar']();

    expect(component['mensagemDeErro']('nome')).toBe('Nome rejeitado pela API');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
