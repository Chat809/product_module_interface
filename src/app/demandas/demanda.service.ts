import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { RepositorioSupabase } from '../core/supabase/repositorio';
import { erroHttp } from '../core/supabase/erros';
import { SupabaseService } from '../core/supabase/supabase.service';
import { hojeIso } from '../financeiro/financeiro.model';
import { Demanda, DemandaRequest, FiltroDemandas, StatusDemanda, UsuarioOpcao } from './demanda.model';

@Injectable({ providedIn: 'root' })
export class DemandaService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly demandas = new RepositorioSupabase<Demanda>(this.supabase, {
    tabela: 'demandas',
    ordem: [{ coluna: 'ordem' }, { coluna: 'criado_em' }],
  });

  /** Atrasada é a que passou do prazo sem ser concluída; não é gravada. */
  private comAtraso(demanda: Demanda): Demanda {
    return { ...demanda, atrasada: !!demanda.prazo && demanda.status !== 'CONCLUIDO' && demanda.prazo < hojeIso() };
  }

  listar(filtro: FiltroDemandas = {}): Observable<Demanda[]> {
    const responsavel = filtro.responsavel === 'me' ? this.auth.usuario()?.id : filtro.responsavel;
    return this.demandas
      .todos({}, (consulta) => {
        if (responsavel) {
          consulta = consulta.contains('responsaveis', [responsavel]);
        }
        if (filtro.abertas) {
          consulta = consulta.neq('status', 'CONCLUIDO');
        }
        return consulta;
      })
      .pipe(map((lista) => lista.map((d) => this.comAtraso(d))));
  }

  /** Novas demandas entram no fim da coluna (gatilho `demandas_no_fim`). */
  criar(dados: DemandaRequest): Observable<Demanda> {
    return this.demandas.criar({ ...dados }).pipe(map((d) => this.comAtraso(d)));
  }

  atualizar(id: string, dados: DemandaRequest): Observable<Demanda> {
    return this.demandas.atualizar(id, { ...dados }).pipe(map((d) => this.comAtraso(d)));
  }

  /** `posicao` é o índice do cartão na coluna de destino, contando todos os cartões dela. */
  mover(id: string, status: StatusDemanda, posicao: number): Observable<Demanda> {
    return this.supabase.rpc<Demanda[]>('mover_demanda', { p_id: id, p_status: status, p_posicao: posicao }).pipe(
      map((linhas) => {
        if (!linhas.length) {
          throw this.supabase.falha(erroHttp(404, 'Demanda não encontrada.'));
        }
        return this.comAtraso(linhas[0]);
      }),
    );
  }

  /** A política do banco só deixa excluir quem criou a demanda ou um administrador. */
  excluir(id: string): Observable<void> {
    return this.demandas.excluir(id, { silencioso: true }).pipe(
      catchError((erro) =>
        throwError(() =>
          this.supabase.falha(
            erro.status === 404 ? erroHttp(403, 'Só quem criou a demanda ou um administrador pode excluí-la.') : erro,
          ),
        ),
      ),
    );
  }

  responsaveis(): Observable<UsuarioOpcao[]> {
    return this.supabase.rpc<UsuarioOpcao[]>('opcoes_usuarios');
  }
}
