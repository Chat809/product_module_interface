import { Component, OnInit, computed, inject, input, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Observable, isObservable, map, of, switchMap } from 'rxjs';
import { paraSnake } from '../core/supabase/caixa';
import { erroHttp } from '../core/supabase/erros';
import { RepositorioSupabase } from '../core/supabase/repositorio';
import { AcaoCadastro, FonteCadastro, ListaCadastro } from '../shared/lista-cadastro/lista-cadastro';
import { AcaoDePagina, AcaoTela, ContextoTela, DefinicaoLista, Registro } from './tela.model';

/** Uma lista de cadastro montada a partir da definição: listar, criar, editar, excluir e ações extras. */
@Component({
  selector: 'app-tela-lista',
  imports: [ListaCadastro, MatButtonModule, MatIconModule],
  template: `
    <app-lista-cadastro
      [titulo]="def().titulo"
      [subtitulo]="def().subtitulo ?? ''"
      [rotuloNovo]="def().rotuloNovo ?? 'Novo'"
      [rotuloBusca]="def().rotuloBusca ?? 'Buscar'"
      [vazio]="def().vazio ?? 'Nenhum registro ainda.'"
      [colunas]="def().colunas"
      [fonte]="fonte"
      [filtrarAtivos]="def().filtrarAtivos ?? false"
      [podeEditar]="podeEditar()"
      [podeCriar]="podeCriar()"
      [podeExcluir]="def().podeExcluir !== false"
      [acoesExtras]="acoes()"
      (novo)="abrir()"
      (editar)="abrir($event)"
      (excluir)="excluir($event)"
    >
      @for (acao of def().acoesDaPagina ?? []; track acao.rotulo) {
        <button mat-stroked-button type="button" (click)="executarDaPagina(acao)">
          <mat-icon>{{ acao.icone }}</mat-icon>
          {{ acao.rotulo }}
        </button>
      }
    </app-lista-cadastro>
  `,
})
export class TelaLista implements OnInit {
  readonly def = input.required<DefinicaoLista>();
  readonly ctx = input.required<ContextoTela>();

  private readonly lista = viewChild.required(ListaCadastro<Registro>);
  private repositorio!: RepositorioSupabase<Registro>;

  protected readonly podeEditar = computed(() => !!this.def().campos?.length && this.def().podeEditar !== false);
  protected readonly podeCriar = computed(() => !!this.def().campos?.length && this.def().podeCriar !== false);
  protected readonly acoes = computed<AcaoCadastro<Registro>[]>(() =>
    (this.def().acoes ?? []).map((acao) => ({
      icone: acao.icone,
      rotulo: acao.rotulo,
      visivel: acao.visivel,
      executar: (item: Registro) => this.executar(acao, item),
    })),
  );

  protected readonly fonte: FonteCadastro<Registro> = (filtro, pagina, tamanho) =>
    this.repositorio.listar(filtro, pagina, tamanho, {}, this.def().ajuste);

  ngOnInit(): void {
    const def = this.def();
    this.repositorio = new RepositorioSupabase<Registro>(this.ctx().supabase, {
      tabela: def.tabelaDeLista ?? def.tabela,
      selecao: def.selecao,
      ordem: def.ordem,
      busca: def.busca,
    });
  }

  recarregar(): void {
    this.lista().recarregar();
  }

  protected abrir(item?: Registro): void {
    const def = this.def();
    const { supabase, dialogos, opcoes } = this.ctx();
    const registro$: Observable<Registro | undefined> = item
      ? supabase.executar<Registro>(() => supabase.cliente.from(def.tabela).select('*').eq(this.chave, this.idDe(item)).single())
      : of(undefined);
    registro$
      .pipe(
        switchMap((registro) =>
          opcoes.resolver(def.campos ?? []).pipe(
            switchMap((campos) =>
              dialogos.formulario(
                {
                  titulo: registro ? `Editar ${def.titulo.toLowerCase()}` : (def.rotuloNovo ?? 'Novo'),
                  campos,
                  entidade: def.entidade,
                  valores: registro ? (def.paraFormulario?.(registro) ?? registro) : { ...(def.valoresPadrao ?? {}) },
                  salvar: (dados) => this.gravar(registro, def.antesDeSalvar ? def.antesDeSalvar(dados, registro) : dados),
                },
                registro ? (def.mensagens?.atualizado ?? 'Alterações salvas.') : (def.mensagens?.criado ?? 'Cadastrado.'),
              ),
            ),
          ),
        ),
      )
      .subscribe(() => {
        opcoes.limpar();
        this.recarregar();
      });
  }

  protected excluir(item: Registro): void {
    const def = this.def();
    const { supabase, dialogos } = this.ctx();
    const descricao = def.descrever?.(item) ?? `O registro "${item['nome'] ?? item['titulo'] ?? item['descricao'] ?? ''}"`;
    dialogos
      .excluir(descricao, () =>
        supabase
          .executar<Registro[]>(() => supabase.cliente.from(def.tabela).delete().eq(this.chave, this.idDe(item)).select(this.chave))
          .pipe(
            map((linhas) => {
              if (!linhas.length) {
                throw supabase.falha(erroHttp(404, 'Registro não encontrado ou sem permissão para excluir.'));
              }
            }),
          ),
      )
      .subscribe(() => {
        this.ctx().opcoes.limpar();
        this.recarregar();
      });
  }

  protected executarDaPagina(acao: AcaoDePagina): void {
    this.concluir(acao.executar(this.ctx()), acao.sucesso);
  }

  private executar(acao: AcaoTela, item: Registro): void {
    this.concluir(acao.executar(item, this.ctx()), acao.sucesso);
  }

  private concluir(resultado: Observable<unknown> | void, sucesso?: string): void {
    if (!isObservable(resultado)) {
      return;
    }
    // Diálogos fechados sem confirmar completam sem emitir: nada a avisar nem recarregar.
    let emitiu = false;
    resultado.subscribe({
      next: () => (emitiu = true),
      complete: () => {
        if (!emitiu) {
          return;
        }
        if (sucesso) {
          this.ctx().notificacao.sucesso(sucesso);
        }
        this.recarregar();
      },
    });
  }

  private get chave(): string {
    return this.def().chave ?? 'id';
  }

  private idDe(item: Registro): unknown {
    return item[this.chave.replace(/_([a-z])/g, (_, letra: string) => letra.toUpperCase())];
  }

  private gravar(registro: Registro | undefined, dados: Record<string, unknown>): Observable<Registro> {
    const { supabase } = this.ctx();
    const tabela = this.def().tabela;
    return supabase.executar<Registro>(() =>
      registro
        ? supabase.cliente.from(tabela).update(paraSnake(dados)).eq(this.chave, this.idDe(registro)).select().single()
        : supabase.cliente.from(tabela).insert(paraSnake(dados)).select().single(),
    );
  }
}
