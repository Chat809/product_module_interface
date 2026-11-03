import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Usuario } from '../../core/auth/auth.model';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { DemandaFormDialog } from '../demanda-form/demanda-form';
import { Demanda, StatusDemanda } from '../demanda.model';
import { DemandaService } from '../demanda.service';
import { DemandaBoard, posicaoNaColuna } from './demanda-board';

function demanda(id: string, status: StatusDemanda, ordem: number, extra: Partial<Demanda> = {}): Demanda {
  return {
    id,
    titulo: `Demanda ${id}`,
    descricao: null,
    status,
    urgencia: 'MEDIA',
    tipo: 'TAREFA',
    prazo: null,
    atrasada: false,
    responsaveis: [],
    checklist: [],
    ordem,
    criadoPor: 'outro',
    criadoEm: null,
    atualizadoEm: null,
    ...extra,
  };
}

describe('posicaoNaColuna', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((id, i) => demanda(id, 'A_FAZER', i));

  it('sem filtro a posição é o próprio índice', () => {
    expect(posicaoNaColuna([a, b, c], [a, b, c], 1)).toBe(1);
    expect(posicaoNaColuna([a, b, c], [a, b, c], 3)).toBe(3);
  });

  it('com filtro, solta antes do cartão visível de destino ou logo após o último visível', () => {
    expect(posicaoNaColuna([b, d], [a, b, c, d], 0)).toBe(1);
    expect(posicaoNaColuna([b, d], [a, b, c, d], 1)).toBe(3);
    expect(posicaoNaColuna([b, d], [a, b, c, d], 2)).toBe(4);
    expect(posicaoNaColuna([], [a, b], 0)).toBe(2);
  });
});

describe('DemandaBoard', () => {
  const eu = { id: 'eu', nome: 'Maria', papel: 'USUARIO' } as Usuario;
  let fixture: ComponentFixture<DemandaBoard>;
  let component: DemandaBoard;
  let elemento: HTMLElement;
  let service: Record<'listar' | 'responsaveis' | 'mover', ReturnType<typeof vi.fn>>;
  let abrir: ReturnType<typeof vi.fn>;
  let resultadoDoDialogo: unknown;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let notificacao: Record<'sucesso' | 'aviso', ReturnType<typeof vi.fn>>;

  const lista = () => [
    demanda('a', 'A_FAZER', 0, { responsaveis: ['eu'], urgencia: 'URGENTE', titulo: 'Pagar fornecedor' }),
    demanda('b', 'A_FAZER', 1),
    demanda('c', 'EM_ANDAMENTO', 0, {
      responsaveis: ['eu', 'joao'],
      prazo: '2026-10-01',
      atrasada: true,
      checklist: [{ texto: 'x', feito: true }],
      criadoPor: 'eu',
    }),
  ];

  beforeEach(async () => {
    service = {
      listar: vi.fn(() => of(lista())),
      responsaveis: vi.fn(() =>
        of([
          { id: 'eu', nome: 'Maria', avatarUrl: null },
          { id: 'joao', nome: 'João', avatarUrl: null },
        ]),
      ),
      mover: vi.fn((id: string, status: StatusDemanda, posicao: number) => of(demanda(id, status, posicao))),
    };
    resultadoDoDialogo = undefined;
    abrir = vi.fn(() => ({ afterClosed: () => of(resultadoDoDialogo) }));
    router = { navigate: vi.fn() };
    notificacao = { sucesso: vi.fn(), aviso: vi.fn() };

    TestBed.configureTestingModule({
      imports: [DemandaBoard],
      providers: [
        { provide: DemandaService, useValue: service },
        { provide: AuthService, useValue: { usuario: signal(eu), ehAdmin: signal(false) } },
        { provide: Notificacao, useValue: notificacao },
        { provide: MatDialog, useValue: { open: abrir } },
        { provide: Router, useValue: router },
      ],
    });
    fixture = TestBed.createComponent(DemandaBoard);
    component = fixture.componentInstance;
    elemento = fixture.nativeElement;
    await fixture.whenStable();
  });

  function coluna(status: StatusDemanda): HTMLElement {
    return elemento.querySelector<HTMLElement>(`.coluna[data-status="${status}"]`)!;
  }

  function soltar(id: string, de: StatusDemanda, para: StatusDemanda, indiceAnterior: number, indice: number): void {
    const item = component['demandas']()!.find((d) => d.id === id)!;
    component['soltar']({
      item: { data: item },
      container: { data: para },
      previousContainer: { data: de },
      previousIndex: indiceAnterior,
      currentIndex: indice,
    } as unknown as CdkDragDrop<StatusDemanda, StatusDemanda, Demanda>);
  }

  it('deve distribuir os cartões nas quatro colunas, com prazo, checklist e responsáveis', () => {
    expect(elemento.querySelectorAll('.coluna').length).toBe(4);
    expect(coluna('A_FAZER').querySelectorAll('.cartao').length).toBe(2);
    const cartao = coluna('EM_ANDAMENTO').querySelector('.cartao')!;
    expect(cartao.querySelector('.atrasada')).not.toBeNull();
    expect(cartao.textContent).toContain('1/1');
    expect(cartao.querySelectorAll('app-avatar').length).toBe(2);
    expect(coluna('CONCLUIDO').textContent).toContain('Arraste um cartão para cá');
  });

  it('deve filtrar por "Só as minhas", urgência e busca', async () => {
    component['somenteMinhas'].set(true);
    await fixture.whenStable();
    expect(coluna('A_FAZER').querySelectorAll('.cartao').length).toBe(1);

    component['limparFiltros']();
    component['urgencia'].set('URGENTE');
    await fixture.whenStable();
    expect(elemento.querySelectorAll('.cartao').length).toBe(1);

    component['limparFiltros']();
    component['busca'].set('fornecedor');
    await fixture.whenStable();
    expect(elemento.querySelector('.cartao h3')?.textContent).toBe('Pagar fornecedor');
  });

  it('ao soltar em outra coluna deve mover na tela e avisar a API com a posição', () => {
    soltar('b', 'A_FAZER', 'EM_ANDAMENTO', 1, 0);

    expect(service.mover).toHaveBeenCalledWith('b', 'EM_ANDAMENTO', 0);
    const andamento = component['visiveis']().get('EM_ANDAMENTO')!.map((d) => d.id);
    expect(andamento).toEqual(['b', 'c']);
  });

  it('com filtro ativo deve converter o índice visível para a posição real', () => {
    component['somenteMinhas'].set(true);
    soltar('a', 'A_FAZER', 'EM_ANDAMENTO', 0, 1);
    expect(service.mover).toHaveBeenCalledWith('a', 'EM_ANDAMENTO', 1);
  });

  it('não deve chamar a API quando o cartão volta ao mesmo lugar e recarrega se ela recusar', () => {
    soltar('a', 'A_FAZER', 'A_FAZER', 0, 0);
    expect(service.mover).not.toHaveBeenCalled();

    service.mover.mockReturnValue(throwError(() => new Error('falha')));
    soltar('a', 'A_FAZER', 'CONCLUIDO', 0, 0);
    expect(service.listar).toHaveBeenCalledTimes(2);
  });

  it('deve abrir o formulário e aplicar a demanda criada ou a exclusão', () => {
    resultadoDoDialogo = { tipo: 'salva', demanda: demanda('nova', 'EM_REVISAO', 0) };
    component['nova']('EM_REVISAO');
    expect(abrir).toHaveBeenCalledWith(
      DemandaFormDialog,
      expect.objectContaining({ data: expect.objectContaining({ status: 'EM_REVISAO', podeExcluir: false }) }),
    );
    expect(component['visiveis']().get('EM_REVISAO')!.map((d) => d.id)).toEqual(['nova']);
    expect(notificacao.sucesso).toHaveBeenCalledWith('Demanda criada.');

    resultadoDoDialogo = { tipo: 'excluida', id: 'c' };
    const minha = component['demandas']()!.find((d) => d.id === 'c')!;
    component['editar'](minha);
    expect(abrir).toHaveBeenLastCalledWith(
      DemandaFormDialog,
      expect.objectContaining({ data: expect.objectContaining({ demanda: minha, podeExcluir: true }) }),
    );
    expect(component['demandas']()!.some((d) => d.id === 'c')).toBe(false);
  });

  it('deve abrir a demanda pedida pela URL e limpar o parâmetro', async () => {
    fixture.componentRef.setInput('abrir', 'c');
    await fixture.whenStable();
    expect(abrir).toHaveBeenCalledWith(
      DemandaFormDialog,
      expect.objectContaining({ data: expect.objectContaining({ demanda: expect.objectContaining({ id: 'c' }) }) }),
    );
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { abrir: null } }));

    fixture.componentRef.setInput('abrir', 'sumiu');
    await fixture.whenStable();
    expect(notificacao.aviso).toHaveBeenCalledWith('Esta demanda não existe mais.');
  });

  it('deve exibir o estado de erro quando não conseguir carregar', async () => {
    service.listar.mockReturnValue(throwError(() => new Error('falha')));
    component['demandas'].set(null);
    component['carregar']();
    await fixture.whenStable();
    expect(elemento.textContent).toContain('Não foi possível carregar as demandas');
  });
});
