import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NEVER, of, throwError } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { Produto } from '../produto.model';
import { ProdutoService } from '../produto.service';
import { ProdutoStore } from '../produto.store';
import { ProdutoFormData, ProdutoFormDialog } from './produto-form';

describe('ProdutoFormDialog', () => {
  const produto: Produto = {
    id: '3f1c2b4e-8a6d-4e2f-9b1a-0c5d7e8f9a10',
    nome: 'Teclado',
    descricao: 'Mecânico',
    preco: 349.9,
    quantidadeEmEstoque: 25,
    criadoEm: '2026-11-01T10:00:00Z',
    atualizadoEm: '2026-11-01T10:00:00Z',
    versao: 2,
  };

  let fixture: ComponentFixture<ProdutoFormDialog>;
  let component: ProdutoFormDialog;
  let produtoService: { criar: ReturnType<typeof vi.fn>; atualizar: ReturnType<typeof vi.fn> };
  let store: {
    adicionar: ReturnType<typeof vi.fn>;
    substituir: ReturnType<typeof vi.fn>;
    carregar: ReturnType<typeof vi.fn>;
  };
  let dialogRef: { close: ReturnType<typeof vi.fn>; disableClose: boolean } & Record<string, unknown>;

  function criar(data: ProdutoFormData | null): void {
    produtoService = { criar: vi.fn(), atualizar: vi.fn() };
    store = { adicionar: vi.fn(), substituir: vi.fn(), carregar: vi.fn() };
    dialogRef = {
      close: vi.fn(),
      disableClose: false,
      backdropClick: () => NEVER,
      keydownEvents: () => NEVER,
    };

    TestBed.configureTestingModule({
      imports: [ProdutoFormDialog],
      providers: [
        { provide: ProdutoService, useValue: produtoService },
        { provide: ProdutoStore, useValue: store },
        { provide: Notificacao, useValue: { sucesso: vi.fn() } },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    fixture = TestBed.createComponent(ProdutoFormDialog);
    component = fixture.componentInstance;
  }

  function preencher(valores: Record<string, unknown>): void {
    component['form'].patchValue(valores as never);
  }

  it('não deve enviar o formulário quando houver campos inválidos', async () => {
    criar(null);
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
    criar(null);
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

  it('deve cadastrar o produto, incluí-lo no catálogo e fechar o diálogo', async () => {
    criar(null);
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
    expect(store.adicionar).toHaveBeenCalledWith(produto);
    expect(dialogRef.close).toHaveBeenCalledWith(produto);
  });

  it('deve preencher o formulário e enviar a versão ao editar', async () => {
    criar({ produto });
    const atualizado = { ...produto, quantidadeEmEstoque: 30, versao: 3 };
    produtoService.atualizar.mockReturnValue(of(atualizado));
    await fixture.whenStable();

    expect(component['form'].getRawValue()).toEqual({
      nome: 'Teclado',
      descricao: 'Mecânico',
      preco: 349.9,
      quantidadeEmEstoque: 25,
    });

    preencher({ quantidadeEmEstoque: 30 });
    component['salvar']();

    expect(produtoService.atualizar).toHaveBeenCalledWith(produto.id, {
      nome: 'Teclado',
      descricao: 'Mecânico',
      preco: 349.9,
      quantidadeEmEstoque: 30,
      versao: 2,
    });
    expect(store.substituir).toHaveBeenCalledWith(atualizado);
    expect(dialogRef.close).toHaveBeenCalledWith(atualizado);
  });

  it('deve recarregar o catálogo e fechar quando houver conflito de versão', async () => {
    criar({ produto });
    produtoService.atualizar.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    await fixture.whenStable();

    component['salvar']();

    expect(store.carregar).toHaveBeenCalledWith(true);
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('deve exibir no campo correspondente os erros de validação retornados pela API', async () => {
    criar(null);
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
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
