import { Type } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { Notificacao } from '../core/feedback/notificacao.service';
import { AjusteDeConsulta, Ordem } from '../core/supabase/repositorio';
import { SupabaseService } from '../core/supabase/supabase.service';
import { DialogosCadastro } from '../shared/formulario-cadastro/dialogos-cadastro.service';
import { CampoCadastro, OpcaoCampo } from '../shared/formulario-cadastro/formulario-cadastro';
import { ColunaCadastro } from '../shared/lista-cadastro/lista-cadastro';
import { OpcoesService } from './opcoes.service';

/** Linha de qualquer tabela, já em camelCase. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Registro = Record<string, any>;

/** De onde vêm as opções de um campo de seleção. */
export type FonteDeOpcoes =
  | { tabela: string; rotulo?: string; valor?: string; detalhe?: string; filtro?: Record<string, unknown>; ordem?: string; selecao?: string }
  | { usuarios: true }
  | { lista: string };

export interface OpcaoTela extends OpcaoCampo {
  /** Linha inteira de onde a opção saiu (para preencher outros campos ao escolher). */
  dados?: Registro;
}

export interface CampoTela extends CampoCadastro {
  fonte?: FonteDeOpcoes;
}

/** O que as definições de tela podem usar: serviços e o nome das pessoas já carregado. */
export interface ContextoTela {
  supabase: SupabaseService;
  dialogos: DialogosCadastro;
  dialog: MatDialog;
  notificacao: Notificacao;
  auth: AuthService;
  opcoes: OpcoesService;
  nomeDoUsuario: (id: string | null | undefined) => string | null;
}

export interface AcaoTela<T = Registro> {
  icone: string;
  rotulo: string;
  visivel?: (item: T) => boolean;
  /** Ao terminar o Observable, a lista recarrega e a mensagem de sucesso aparece. */
  executar: (item: T, ctx: ContextoTela) => Observable<unknown> | void;
  sucesso?: string;
}

export interface AcaoDePagina {
  icone: string;
  rotulo: string;
  executar: (ctx: ContextoTela) => Observable<unknown> | void;
  sucesso?: string;
}

/** Lista com formulário genérico sobre uma tabela; a RLS decide o que cada pessoa vê e grava. */
export interface DefinicaoLista<T = Registro> {
  tipo?: 'lista';
  /** Rótulo da aba quando a tela tem mais de uma. */
  aba?: string;
  titulo: string;
  subtitulo?: string;
  rotuloNovo?: string;
  rotuloBusca?: string;
  vazio?: string;
  tabela: string;
  /** Tabela ou view usada só para listar (ex.: saldos calculados). */
  tabelaDeLista?: string;
  /** Chave primária; padrão `id`. */
  chave?: string;
  selecao?: string;
  ordem?: Ordem[];
  busca?: string[];
  filtrarAtivos?: boolean;
  ajuste?: AjusteDeConsulta;
  colunas: ColunaCadastro<T>[];
  /** Sem campos, a lista é só de consulta. */
  campos?: CampoTela[];
  /** Tabela com coluna `extras`: os campos extras entram no formulário. */
  entidade?: string;
  valoresPadrao?: Record<string, unknown>;
  paraFormulario?: (registro: T) => Record<string, unknown>;
  antesDeSalvar?: (dados: Record<string, unknown>, registro?: T) => Record<string, unknown>;
  podeCriar?: boolean;
  podeEditar?: boolean;
  podeExcluir?: boolean;
  descrever?: (item: T) => string;
  acoes?: AcaoTela<T>[];
  acoesDaPagina?: AcaoDePagina[];
  mensagens?: { criado?: string; atualizado?: string };
}

export interface DefinicaoComponente {
  tipo: 'componente';
  aba: string;
  componente: () => Promise<Type<unknown>>;
}

export type AbaTela = DefinicaoLista | DefinicaoComponente;

export interface Tela {
  abas: AbaTela[];
}

export type FabricaDeTela = (ctx: ContextoTela) => Tela;
