import { Component, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { catchError, map, of } from 'rxjs';
import { RepositorioSupabase } from '../../core/supabase/repositorio';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { ACOES_DE_AUDITORIA, RegistroAuditoria, mudancasDe, rotuloDaColuna } from '../../shared/auditoria/historico-auditoria';
import { AcaoCadastro, ColunaCadastro, FonteCadastro, ListaCadastro } from '../../shared/lista-cadastro/lista-cadastro';
import { TextoDialog, TextoDialogData } from '../../shared/texto-dialog/texto-dialog';
import { OpcoesService } from '../../telas/opcoes.service';

/** Tabelas com trilha, para o filtro. */
const TABELAS = [
  'clientes', 'leads', 'reclamacoes', 'produtos', 'demandas', 'contas_pagar', 'contas_receber', 'fornecedores', 'centros_custo',
  'contas_bancarias', 'lancamentos_caixa', 'plano_contas', 'propostas_comerciais', 'pedidos_venda', 'vagas_emprego',
  'pessoas_candidatas', 'perfis', 'grupos_permissao', 'grupos_permissao_membros', 'parametros_sistema', 'modulos_ativos',
];

/** Quem criou, alterou ou excluiu o quê, em todas as tabelas com trilha. */
@Component({
  selector: 'app-auditoria',
  imports: [FormsModule, ListaCadastro, MatDialogModule, MatFormFieldModule, MatSelectModule],
  template: `
    <app-lista-cadastro
      titulo="Auditoria"
      subtitulo="Histórico de criações, alterações e exclusões. A busca procura pelo identificador do registro."
      rotuloBusca="Buscar pelo identificador do registro"
      vazio="Nada registrado ainda."
      [colunas]="colunas"
      [fonte]="fonte"
      [filtrarAtivos]="false"
      [podeEditar]="false"
      [acoesExtras]="acoes"
    >
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Tabela</mat-label>
        <mat-select [ngModel]="tabela()" (ngModelChange)="filtrar($event)">
          <mat-option [value]="null">Todas</mat-option>
          @for (t of tabelas; track t) {
            <mat-option [value]="t">{{ rotuloDaColuna(t) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </app-lista-cadastro>
  `,
})
export class Auditoria {
  private readonly supabase = inject(SupabaseService);
  private readonly dialog = inject(MatDialog);
  private readonly lista = viewChild.required(ListaCadastro<RegistroAuditoria>);
  private readonly repositorio = new RepositorioSupabase<RegistroAuditoria>(this.supabase, {
    tabela: 'trilha_auditoria',
    busca: ['registro_id'],
  });
  private readonly pessoas = toSignal(
    inject(OpcoesService).usuarios().pipe(
      map((lista) => new Map(lista.map((p) => [p.id, p.nome]))),
      catchError(() => of(new Map<string, string>())),
    ),
    { initialValue: new Map<string, string>() },
  );

  protected readonly tabelas = TABELAS;
  protected readonly rotuloDaColuna = rotuloDaColuna;
  protected readonly tabela = signal<string | null>(null);

  protected readonly fonte: FonteCadastro<RegistroAuditoria> = (filtro, pagina, tamanho) =>
    this.repositorio.listar(filtro, pagina, tamanho, { tabela: this.tabela() });

  protected readonly colunas: ColunaCadastro<RegistroAuditoria>[] = [
    { chave: 'criadoEm', rotulo: 'Quando', valor: (r) => new Date(r.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) },
    { chave: 'acao', rotulo: 'Ação', valor: (r) => ACOES_DE_AUDITORIA[r.acao]?.rotulo ?? r.acao },
    { chave: 'tabela', rotulo: 'Tabela', valor: (r) => rotuloDaColuna(r.tabela), detalhe: (r) => r.registroId },
    { chave: 'usuario', rotulo: 'Quem', valor: (r) => (r.usuarioId ? (this.pessoas().get(r.usuarioId) ?? 'Usuário removido') : 'Sistema') },
    { chave: 'campos', rotulo: 'Campos', valor: (r) => mudancasDe(r).map((m) => m.campo).join(', ') || null },
  ];

  protected readonly acoes: AcaoCadastro<RegistroAuditoria>[] = [
    {
      icone: 'visibility',
      rotulo: 'Ver detalhes',
      executar: (r) => {
        const texto =
          r.acao === 'ALTERACAO'
            ? mudancasDe(r).map((m) => `${m.campo}: ${m.de} → ${m.para}`).join('\n')
            : JSON.stringify(r.alteracoes ?? {}, null, 2);
        this.dialog.open<TextoDialog, TextoDialogData>(TextoDialog, {
          data: { titulo: `${ACOES_DE_AUDITORIA[r.acao]?.rotulo ?? r.acao} · ${rotuloDaColuna(r.tabela)}`, mensagem: '', rotulo: 'Detalhes', valor: texto || '—', max: 100000, textoConfirmar: 'Fechar' },
          width: '640px',
        });
      },
    },
  ];

  protected filtrar(tabela: string | null): void {
    this.tabela.set(tabela);
    this.lista().recarregar();
  }
}
