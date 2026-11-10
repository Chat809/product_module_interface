import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay } from 'rxjs';
import { LIMITE_SEM_PAGINA } from '../core/supabase/repositorio';
import { SupabaseService } from '../core/supabase/supabase.service';
import { UsuarioOpcao } from '../demandas/demanda.model';
import { CampoCadastro } from '../shared/formulario-cadastro/formulario-cadastro';
import { CampoTela, FonteDeOpcoes, OpcaoTela, Registro } from './tela.model';

/** Opções de seleção vindas do banco, guardadas por um minuto para não repetir a consulta a cada diálogo. */
@Injectable({ providedIn: 'root' })
export class OpcoesService {
  private readonly supabase = inject(SupabaseService);
  private readonly cache = new Map<string, Observable<OpcaoTela[]>>();

  de(fonte: FonteDeOpcoes): Observable<OpcaoTela[]> {
    const chave = JSON.stringify(fonte);
    let opcoes = this.cache.get(chave);
    if (!opcoes) {
      opcoes = this.carregar(fonte).pipe(
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: false, windowTime: 60_000 }),
      );
      this.cache.set(chave, opcoes);
    }
    return opcoes;
  }

  usuarios(): Observable<UsuarioOpcao[]> {
    return this.de({ usuarios: true }).pipe(map((opcoes) => opcoes.map((o) => o.dados as UsuarioOpcao)));
  }

  /** Preenche as opções dos campos que têm fonte. */
  resolver(campos: CampoTela[]): Observable<CampoCadastro[]> {
    const comFonte = campos.filter((campo) => campo.fonte);
    if (!comFonte.length) {
      return of(campos);
    }
    return forkJoin(comFonte.map((campo) => this.de(campo.fonte!))).pipe(
      map((listas) => {
        const porChave = new Map(comFonte.map((campo, i) => [campo.chave, listas[i]]));
        return campos.map(({ fonte, ...campo }) => (porChave.has(campo.chave) ? { ...campo, opcoes: porChave.get(campo.chave) } : campo));
      }),
    );
  }

  limpar(): void {
    this.cache.clear();
  }

  private carregar(fonte: FonteDeOpcoes): Observable<OpcaoTela[]> {
    if ('usuarios' in fonte) {
      return this.supabase
        .rpc<UsuarioOpcao[]>('opcoes_usuarios', {}, { silencioso: true })
        .pipe(map((pessoas) => pessoas.map((p) => ({ valor: p.id, rotulo: p.nome, dados: p }))));
    }
    if ('lista' in fonte) {
      return this.supabase
        .executar<Registro[]>(
          () =>
            this.supabase.cliente
              .from('listas_auxiliares')
              .select('valor, rotulo, cor')
              .eq('lista', fonte.lista)
              .eq('ativo', true)
              .order('ordem')
              .order('rotulo'),
          { silencioso: true },
        )
        .pipe(map((linhas) => linhas.map((l) => ({ valor: l['valor'], rotulo: l['rotulo'], dados: l }))));
    }
    const valor = fonte.valor ?? 'id';
    const rotulo = fonte.rotulo ?? 'nome';
    return this.supabase
      .executar<Registro[]>(
        () => {
          let consulta = this.supabase.cliente.from(fonte.tabela).select(fonte.selecao ?? '*');
          for (const [coluna, filtro] of Object.entries(fonte.filtro ?? {})) {
            consulta = consulta.eq(coluna, filtro);
          }
          return consulta.order(fonte.ordem ?? rotulo).limit(LIMITE_SEM_PAGINA);
        },
        { silencioso: true },
      )
      .pipe(
        map((linhas) =>
          linhas.map((linha) => {
            const camel = (coluna: string) => linha[coluna.replace(/_([a-z])/g, (_, letra: string) => letra.toUpperCase())];
            const detalhe = fonte.detalhe ? camel(fonte.detalhe) : null;
            return {
              valor: camel(valor),
              rotulo: detalhe ? `${camel(rotulo)} · ${detalhe}` : String(camel(rotulo) ?? ''),
              dados: linha,
            };
          }),
        ),
      );
  }
}
