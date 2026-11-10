import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { RepositorioSupabase } from '../../core/supabase/repositorio';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { CampoCadastro, OpcaoCampo, TipoCampo } from '../formulario-cadastro/formulario-cadastro';

export type TipoCampoExtra = 'texto' | 'textarea' | 'email' | 'numero' | 'data' | 'select' | 'multipla' | 'toggle';

/** Campo configurado em Configurações › Campos extras e gravado na coluna `extras` da entidade. */
export interface CampoExtra {
  id: string;
  entidade: string;
  chave: string;
  rotulo: string;
  tipo: TipoCampoExtra;
  opcoes: (string | OpcaoCampo)[] | null;
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
}

/** Entidades com coluna `extras`, na ordem da tela de configuração. */
export const ENTIDADES_COM_EXTRAS: { valor: string; rotulo: string }[] = [
  { valor: 'clientes', rotulo: 'Clientes' },
  { valor: 'leads', rotulo: 'Leads' },
  { valor: 'reclamacoes', rotulo: 'Reclamações' },
  { valor: 'produtos', rotulo: 'Produtos' },
  { valor: 'fornecedores', rotulo: 'Fornecedores' },
  { valor: 'demandas', rotulo: 'Demandas' },
  { valor: 'propostas_comerciais', rotulo: 'Propostas' },
  { valor: 'pedidos_venda', rotulo: 'Pedidos' },
  { valor: 'pessoas_candidatas', rotulo: 'Candidatos' },
];

export const TIPOS_DE_CAMPO_EXTRA: Record<TipoCampoExtra, string> = {
  texto: 'Texto curto',
  textarea: 'Texto longo',
  email: 'E-mail',
  numero: 'Número',
  data: 'Data',
  select: 'Lista (uma opção)',
  multipla: 'Lista (várias opções)',
  toggle: 'Sim ou não',
};

/** Prefixo das chaves no formulário genérico: `extra__cor` vira `{ extras: { cor } }` ao salvar. Sem ponto, que o Angular lê como caminho. */
export const PREFIXO_EXTRA = 'extra__';

export function opcoesDoExtra(campo: CampoExtra): OpcaoCampo[] {
  return (campo.opcoes ?? []).map((opcao) => (typeof opcao === 'string' ? { valor: opcao, rotulo: opcao } : opcao));
}

/** Campos extras no formato do formulário genérico de cadastro. */
export function camposDeCadastro(extras: CampoExtra[]): CampoCadastro[] {
  return extras.map((campo) => ({
    chave: PREFIXO_EXTRA + campo.chave,
    rotulo: campo.rotulo,
    tipo: campo.tipo as TipoCampo,
    obrigatorio: campo.obrigatorio,
    meia: campo.tipo !== 'textarea' && campo.tipo !== 'multipla',
    opcoes: opcoesDoExtra(campo),
    max: campo.tipo === 'textarea' ? 2000 : campo.tipo === 'numero' ? undefined : 200,
  }));
}

/** Valores iniciais dos campos extras a partir de `registro.extras` (sim/não começa desligado). */
export function valoresDosExtras(extras: CampoExtra[], gravados: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return Object.fromEntries(
    extras.map((campo) => [PREFIXO_EXTRA + campo.chave, gravados?.[campo.chave] ?? (campo.tipo === 'toggle' ? false : null)]),
  );
}

/** Separa os campos extras dos dados do formulário e junta ao que já estava gravado (campos desativados são mantidos). */
export function juntarExtras(dados: Record<string, unknown>, anteriores: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const extras: Record<string, unknown> = { ...(anteriores ?? {}) };
  const resto: Record<string, unknown> = {};
  let temExtras = false;
  for (const [chave, valor] of Object.entries(dados)) {
    if (chave.startsWith(PREFIXO_EXTRA)) {
      extras[chave.slice(PREFIXO_EXTRA.length)] = valor;
      temExtras = true;
    } else {
      resto[chave] = valor;
    }
  }
  return temExtras ? { ...resto, extras } : resto;
}

@Injectable({ providedIn: 'root' })
export class CamposExtrasService {
  private readonly supabase = inject(SupabaseService);
  private readonly repositorio = new RepositorioSupabase<CampoExtra>(this.supabase, {
    tabela: 'campos_extras',
    ordem: [{ coluna: 'entidade' }, { coluna: 'ordem' }, { coluna: 'rotulo' }],
  });
  private readonly cache = new Map<string, Observable<CampoExtra[]>>();

  /** Campos ativos da entidade; falhas viram lista vazia para não travar o formulário. */
  ativos(entidade: string): Observable<CampoExtra[]> {
    let campos = this.cache.get(entidade);
    if (!campos) {
      campos = this.repositorio.todos({ entidade, ativo: true }, undefined, undefined, { silencioso: true }).pipe(
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: false, windowTime: 60_000 }),
      );
      this.cache.set(entidade, campos);
    }
    return campos;
  }

  todos(): Observable<CampoExtra[]> {
    return this.repositorio.todos();
  }

  salvar(id: string | null, dados: Record<string, unknown>): Observable<CampoExtra> {
    this.cache.clear();
    return this.repositorio.salvar(id, dados);
  }

  excluir(id: string): Observable<void> {
    this.cache.clear();
    return this.repositorio.excluir(id);
  }
}
