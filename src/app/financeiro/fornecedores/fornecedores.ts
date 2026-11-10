import { Component, inject, viewChild } from '@angular/core';
import { DialogosCadastro } from '../../shared/formulario-cadastro/dialogos-cadastro.service';
import { CampoCadastro } from '../../shared/formulario-cadastro/formulario-cadastro';
import { ColunaCadastro, FonteCadastro, ListaCadastro } from '../../shared/lista-cadastro/lista-cadastro';
import { Fornecedor, formatarDocumento } from '../financeiro.model';
import { FinanceiroService } from '../financeiro.service';

const CATEGORIAS = ['Matéria-prima', 'Embalagens', 'Serviços', 'Transporte', 'Tecnologia', 'Aluguel', 'Marketing', 'Impostos'];

const CAMPOS: CampoCadastro[] = [
  { chave: 'razaoSocial', rotulo: 'Razão social ou nome', obrigatorio: true, max: 150 },
  { chave: 'nomeFantasia', rotulo: 'Nome fantasia', max: 150, meia: true },
  {
    chave: 'documento',
    rotulo: 'CPF ou CNPJ',
    max: 20,
    meia: true,
    padrao: /^[\d./\-\s]*$/,
    mensagemPadrao: 'Use só números, pontos, barra e hífen',
  },
  { chave: 'categoria', rotulo: 'Categoria', max: 60, meia: true, sugestoes: CATEGORIAS },
  { chave: 'contato', rotulo: 'Pessoa de contato', max: 100, meia: true },
  { chave: 'email', rotulo: 'E-mail', tipo: 'email', max: 254, meia: true },
  { chave: 'telefone', rotulo: 'Telefone', max: 30, meia: true },
  { chave: 'chavePix', rotulo: 'Chave Pix', max: 140, dica: 'Preenchida automaticamente nos lançamentos via Pix' },
  { chave: 'observacoes', rotulo: 'Observações', tipo: 'textarea', max: 1000 },
  { chave: 'ativo', rotulo: 'Ativo (aparece nos lançamentos)', tipo: 'toggle' },
];

@Component({
  selector: 'app-fornecedores',
  imports: [ListaCadastro],
  template: `
    <app-lista-cadastro
      titulo="Fornecedores"
      subtitulo="Quem fornece produtos e serviços. Fornecedores com contas lançadas não podem ser excluídos: inative-os."
      rotuloNovo="Novo fornecedor"
      rotuloBusca="Buscar por nome, CNPJ, categoria ou e-mail"
      vazio="Nenhum fornecedor cadastrado ainda."
      [colunas]="colunas"
      [fonte]="fonte"
      (novo)="abrir()"
      (editar)="abrir($event)"
      (excluir)="excluir($event)"
    />
  `,
})
export class Fornecedores {
  private readonly service = inject(FinanceiroService);
  private readonly dialogos = inject(DialogosCadastro);
  private readonly lista = viewChild.required(ListaCadastro<Fornecedor>);

  protected readonly fonte: FonteCadastro<Fornecedor> = (filtro, pagina, tamanho) =>
    this.service.listarFornecedores(filtro, pagina, tamanho);

  protected readonly colunas: ColunaCadastro<Fornecedor>[] = [
    { chave: 'razaoSocial', rotulo: 'Fornecedor', valor: (f) => f.razaoSocial, detalhe: (f) => f.nomeFantasia },
    { chave: 'documento', rotulo: 'CPF/CNPJ', valor: (f) => formatarDocumento(f.documento) },
    { chave: 'categoria', rotulo: 'Categoria', valor: (f) => f.categoria },
    { chave: 'contato', rotulo: 'Contato', valor: (f) => f.contato ?? f.email, detalhe: (f) => f.telefone },
  ];

  protected abrir(fornecedor?: Fornecedor): void {
    this.dialogos
      .formulario(
        {
          titulo: fornecedor ? 'Editar fornecedor' : 'Novo fornecedor',
          entidade: 'fornecedores',
          campos: CAMPOS,
          valores: fornecedor ? { ...fornecedor, documento: formatarDocumento(fornecedor.documento) } : undefined,
          salvar: (dados) => this.service.salvarFornecedor(fornecedor?.id ?? null, dados),
        },
        fornecedor ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.',
      )
      .subscribe(() => this.lista().recarregar());
  }

  protected excluir(fornecedor: Fornecedor): void {
    this.dialogos
      .excluir(`O fornecedor "${fornecedor.razaoSocial}"`, () => this.service.excluirFornecedor(fornecedor.id))
      .subscribe(() => this.lista().recarregar());
  }
}
