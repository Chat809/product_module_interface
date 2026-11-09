import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { Observable, catchError, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { UsuarioOpcao } from '../../demandas/demanda.model';
import { formatarDocumento } from '../../financeiro/financeiro.model';
import { DialogosCadastro } from '../../shared/formulario-cadastro/dialogos-cadastro.service';
import { CampoCadastro } from '../../shared/formulario-cadastro/formulario-cadastro';
import { ColunaCadastro, FonteCadastro, ListaCadastro } from '../../shared/lista-cadastro/lista-cadastro';
import { ClienteFicha, ClienteFichaData } from '../cliente-ficha/cliente-ficha';
import { Cliente, CrmOrigem, UFS } from '../crm.model';
import { CrmService } from '../crm.service';

function camposDoCliente(responsaveis: UsuarioOpcao[], origens: CrmOrigem[]): CampoCadastro[] {
  return [
    {
      chave: 'tipo',
      rotulo: 'Tipo',
      tipo: 'select',
      obrigatorio: true,
      meia: true,
      opcoes: [
        { valor: 'PF', rotulo: 'Pessoa física' },
        { valor: 'PJ', rotulo: 'Pessoa jurídica' },
      ],
    },
    {
      chave: 'documento',
      rotulo: 'CPF ou CNPJ',
      max: 20,
      meia: true,
      padrao: /^[\d./\-\s]*$/,
      mensagemPadrao: 'Use só números, pontos, barra e hífen',
    },
    { chave: 'nome', rotulo: 'Nome ou razão social', obrigatorio: true, max: 150 },
    { chave: 'email', rotulo: 'E-mail', tipo: 'email', max: 254, meia: true },
    { chave: 'telefone', rotulo: 'Telefone', max: 30, meia: true },
    { chave: 'dataNascimento', rotulo: 'Data de nascimento', tipo: 'data', meia: true },
    { chave: 'cep', rotulo: 'CEP', max: 9, meia: true, padrao: /^\d{5}-?\d{3}$/, mensagemPadrao: 'Informe um CEP válido' },
    { chave: 'endereco', rotulo: 'Endereço', max: 200 },
    { chave: 'cidade', rotulo: 'Cidade', max: 80, meia: true },
    { chave: 'uf', rotulo: 'UF', tipo: 'select', meia: true, opcoes: UFS.map((uf) => ({ valor: uf, rotulo: uf })) },
    { chave: 'origem', rotulo: 'Origem', max: 60, meia: true, sugestoes: origens.filter((o) => o.ativo).map((o) => o.nome) },
    {
      chave: 'responsavelId',
      rotulo: 'Responsável',
      tipo: 'select',
      meia: true,
      opcoes: responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome })),
    },
    { chave: 'observacoes', rotulo: 'Observações', tipo: 'textarea', max: 2000 },
    { chave: 'ativo', rotulo: 'Ativo (aparece nas contas a receber e reclamações)', tipo: 'toggle' },
  ];
}

@Component({
  selector: 'app-clientes',
  imports: [ListaCadastro],
  template: `
    <app-lista-cadastro
      titulo="Clientes"
      subtitulo="Abra a ficha para ver interações, reclamações e contas. Clientes com histórico não podem ser excluídos: inative-os."
      rotuloNovo="Novo cliente"
      rotuloBusca="Buscar por nome, CPF/CNPJ, e-mail, telefone ou cidade"
      vazio="Nenhum cliente cadastrado ainda."
      [colunas]="colunas()"
      [fonte]="fonte"
      [podeAbrir]="true"
      (novo)="editar()"
      (abrir)="abrir($event)"
      (editar)="editar($event)"
      (excluir)="excluir($event)"
    />
  `,
})
export class Clientes {
  private readonly crm = inject(CrmService);
  private readonly dialogos = inject(DialogosCadastro);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly lista = viewChild.required(ListaCadastro<Cliente>);

  private readonly responsaveis = toSignal(this.crm.responsaveis().pipe(catchError(() => of([]))), {
    initialValue: [] as UsuarioOpcao[],
  });
  private readonly origens = toSignal(this.crm.origens().pipe(catchError(() => of([]))), {
    initialValue: [] as CrmOrigem[],
  });
  private readonly pessoas = computed(() => new Map(this.responsaveis().map((r) => [r.id, r])));

  protected readonly fonte: FonteCadastro<Cliente> = (filtro, pagina, tamanho) =>
    this.crm.listarClientes(filtro, pagina, tamanho);

  protected readonly colunas = computed<ColunaCadastro<Cliente>[]>(() => {
    const pessoas = this.pessoas();
    return [
      { chave: 'nome', rotulo: 'Cliente', valor: (c) => c.nome, detalhe: (c) => formatarDocumento(c.documento) },
      { chave: 'contato', rotulo: 'Contato', valor: (c) => c.email ?? c.telefone, detalhe: (c) => (c.email ? c.telefone : null) },
      { chave: 'cidade', rotulo: 'Cidade', valor: (c) => (c.cidade ? `${c.cidade}${c.uf ? '/' + c.uf : ''}` : c.uf) },
      { chave: 'responsavel', rotulo: 'Responsável', valor: (c) => (c.responsavelId ? pessoas.get(c.responsavelId)?.nome : null) },
    ];
  });

  protected abrir(cliente: Cliente): void {
    this.dialog
      .open<ClienteFicha, ClienteFichaData, boolean>(ClienteFicha, {
        data: {
          cliente,
          pessoas: this.pessoas(),
          podeEditar: true,
          podeVerFinanceiro: this.auth.podeAcessar('financeiro/contas-receber'),
          editar: (atual) => this.formulario(atual),
        },
        width: '820px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((alterado) => {
        if (alterado) {
          this.lista().recarregar();
        }
      });
  }

  protected editar(cliente?: Cliente): void {
    this.formulario(cliente).subscribe(() => this.lista().recarregar());
  }

  protected excluir(cliente: Cliente): void {
    this.dialogos
      .excluir(`O cliente "${cliente.nome}"`, () => this.crm.excluirCliente(cliente.id))
      .subscribe(() => this.lista().recarregar());
  }

  private formulario(cliente?: Cliente): Observable<Cliente> {
    return this.dialogos.formulario(
      {
        titulo: cliente ? 'Editar cliente' : 'Novo cliente',
        campos: camposDoCliente(this.responsaveis(), this.origens()),
        valores: cliente
          ? { ...cliente, documento: formatarDocumento(cliente.documento) }
          : { tipo: 'PF', responsavelId: this.auth.usuario()?.id ?? null },
        salvar: (dados) => this.crm.salvarCliente(cliente?.id ?? null, dados),
      },
      cliente ? 'Cliente atualizado.' : 'Cliente cadastrado.',
    );
  }
}
