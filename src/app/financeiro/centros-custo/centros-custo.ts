import { Component, inject, viewChild } from '@angular/core';
import { DialogosCadastro } from '../../shared/formulario-cadastro/dialogos-cadastro.service';
import { CampoCadastro } from '../../shared/formulario-cadastro/formulario-cadastro';
import { ColunaCadastro, FonteCadastro, ListaCadastro } from '../../shared/lista-cadastro/lista-cadastro';
import { CentroCusto } from '../financeiro.model';
import { FinanceiroService } from '../financeiro.service';

const CAMPOS: CampoCadastro[] = [
  {
    chave: 'codigo',
    rotulo: 'Código',
    obrigatorio: true,
    max: 20,
    meia: true,
    padrao: /^\s*[A-Za-z0-9][A-Za-z0-9._-]*\s*$/,
    mensagemPadrao: 'Letras, números ou . _ -, começando por letra ou número',
    dica: 'Ex.: MKT, ADM-01',
  },
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80, meia: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea', max: 300 },
  { chave: 'ativo', rotulo: 'Ativo (aparece nos lançamentos)', tipo: 'toggle' },
];

@Component({
  selector: 'app-centros-custo',
  imports: [ListaCadastro],
  template: `
    <app-lista-cadastro
      titulo="Centros de custo"
      subtitulo="Áreas da empresa para separar receitas e despesas nos lançamentos e relatórios."
      rotuloNovo="Novo centro de custo"
      rotuloBusca="Buscar por código, nome ou descrição"
      vazio="Nenhum centro de custo cadastrado ainda."
      [colunas]="colunas"
      [fonte]="fonte"
      (novo)="abrir()"
      (editar)="abrir($event)"
      (excluir)="excluir($event)"
    />
  `,
})
export class CentrosCusto {
  private readonly service = inject(FinanceiroService);
  private readonly dialogos = inject(DialogosCadastro);
  private readonly lista = viewChild.required(ListaCadastro<CentroCusto>);

  protected readonly fonte: FonteCadastro<CentroCusto> = (filtro, pagina, tamanho) =>
    this.service.listarCentros(filtro, pagina, tamanho);

  protected readonly colunas: ColunaCadastro<CentroCusto>[] = [
    { chave: 'codigo', rotulo: 'Código', valor: (c) => c.codigo },
    { chave: 'nome', rotulo: 'Nome', valor: (c) => c.nome, detalhe: (c) => c.descricao },
  ];

  protected abrir(centro?: CentroCusto): void {
    this.dialogos
      .formulario(
        {
          titulo: centro ? 'Editar centro de custo' : 'Novo centro de custo',
          campos: CAMPOS,
          valores: centro ? { ...centro } : undefined,
          salvar: (dados) => this.service.salvarCentro(centro?.id ?? null, dados),
        },
        centro ? 'Centro de custo atualizado.' : 'Centro de custo cadastrado.',
      )
      .subscribe(() => this.lista().recarregar());
  }

  protected excluir(centro: CentroCusto): void {
    this.dialogos
      .excluir(`O centro de custo "${centro.codigo} · ${centro.nome}"`, () => this.service.excluirCentro(centro.id))
      .subscribe(() => this.lista().recarregar());
  }
}
