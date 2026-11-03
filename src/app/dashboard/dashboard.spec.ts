import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProdutoDialogs } from '../produtos/produto-dialogs.service';
import { Produto, ResumoEstoque } from '../produtos/produto.model';
import { ProdutoService } from '../produtos/produto.service';
import { ProdutoStore } from '../produtos/produto.store';
import { Dashboard } from './dashboard';

function produto(nome: string, quantidadeEmEstoque: number): Produto {
  return {
    id: nome,
    nome,
    descricao: null,
    preco: 10,
    quantidadeEmEstoque,
    criadoEm: '2026-11-01T10:00:00Z',
    atualizadoEm: '2026-11-01T10:00:00Z',
    versao: 0,
  };
}

describe('Dashboard', () => {
  const resumo: ResumoEstoque = {
    totalProdutos: 4,
    totalItens: 53,
    valorTotal: 530,
    esgotados: 1,
    estoqueBaixo: 2,
    limiteEstoqueBaixo: 3,
  };
  const catalogo = [produto('Teclado', 50), produto('Mouse', 2), produto('Webcam', 0), produto('Hub', 1)];

  let fixture: ComponentFixture<Dashboard>;
  let produtoService: { resumo: ReturnType<typeof vi.fn>; listarCatalogo: ReturnType<typeof vi.fn> };
  let dialogs: { movimentar: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    produtoService = { resumo: vi.fn(() => of(resumo)), listarCatalogo: vi.fn(() => of(catalogo)) };
    dialogs = { movimentar: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: ProdutoService, useValue: produtoService },
        { provide: ProdutoDialogs, useValue: dialogs },
      ],
    });
    fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();
  });

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  }

  it('deve exibir os indicadores do resumo e aplicar o limite de estoque baixo da API', () => {
    expect(texto()).toContain('Produtos cadastrados');
    expect(texto()).toContain('53');
    expect(texto()).toContain('530');
    expect(texto()).toContain('até 3');
    expect(TestBed.inject(ProdutoStore).limiteEstoqueBaixo()).toBe(3);
  });

  it('deve listar os produtos a repor, esgotados primeiro', () => {
    const nomes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.item .nome')).map((n) =>
      n.textContent!.trim(),
    );

    expect(nomes).toEqual(['Webcam', 'Hub', 'Mouse']);
  });

  it('deve abrir a entrada de estoque e recarregar o resumo depois', () => {
    const botao = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.item button');
    botao?.click();

    expect(dialogs.movimentar).toHaveBeenCalledWith(catalogo[2], 'ENTRADA');
    expect(produtoService.resumo).toHaveBeenCalledTimes(2);
  });
});
