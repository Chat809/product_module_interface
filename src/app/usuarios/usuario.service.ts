import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, tap } from 'rxjs';
import { Papel, Usuario } from '../core/auth/auth.model';
import { AuthService, COLUNAS_DO_PERFIL } from '../core/auth/auth.service';
import { enviarAvatar, removerAvatar } from '../core/supabase/avatares';
import { RepositorioSupabase } from '../core/supabase/repositorio';
import { SupabaseService } from '../core/supabase/supabase.service';
import { Pagina } from '../produtos/produto.model';

export interface AtualizarUsuario {
  nome: string;
  email: string;
  papel: Papel;
  acessos: string[];
  departamento: string | null;
  /** Cargo. */
  funcao: string | null;
}

export interface NovoUsuario extends AtualizarUsuario {
  senha: string;
}

/**
 * Leitura direto em `perfis` (a política libera para quem tem Usuários e acessos); criar, alterar e-mail ou papel,
 * redefinir senha e excluir passam pela Edge Function `admin-usuarios`, que usa a chave do servidor.
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly perfis = new RepositorioSupabase<Usuario>(this.supabase, {
    tabela: 'perfis',
    selecao: COLUNAS_DO_PERFIL,
    ordem: [{ coluna: 'nome' }],
  });

  listar(pagina: number, tamanho: number): Observable<Pagina<Usuario>> {
    return this.perfis.listar({}, pagina, tamanho);
  }

  criar(dados: NovoUsuario): Observable<Usuario> {
    return this.supabase
      .funcao<{ id: string }>('admin-usuarios', { acao: 'criar', ...dados })
      .pipe(switchMap(({ id }) => this.perfis.buscar(id)));
  }

  atualizar(id: string, dados: AtualizarUsuario): Observable<Usuario> {
    return this.supabase.funcao<{ id: string }>('admin-usuarios', { acao: 'atualizar', id, ...dados }).pipe(
      switchMap(() => this.perfis.buscar(id)),
      tap((usuario) => this.auth.atualizarUsuario(usuario)),
    );
  }

  excluir(id: string): Observable<void> {
    return this.supabase.funcao<unknown>('admin-usuarios', { acao: 'excluir', id }).pipe(map(() => undefined));
  }

  redefinirSenha(id: string, senha: string): Observable<void> {
    return this.supabase
      .funcao<unknown>('admin-usuarios', { acao: 'redefinir_senha', id, senha })
      .pipe(map(() => undefined));
  }

  enviarAvatar(id: string, arquivo: File): Observable<Usuario> {
    return this.perfis.buscar(id).pipe(
      switchMap((usuario) => enviarAvatar(this.supabase, id, arquivo, usuario.avatarUrl)),
      switchMap(() => this.perfis.buscar(id)),
      tap((usuario) => this.auth.atualizarUsuario(usuario)),
    );
  }

  removerAvatar(id: string): Observable<Usuario> {
    return this.perfis.buscar(id).pipe(
      switchMap((usuario) => removerAvatar(this.supabase, id, usuario.avatarUrl)),
      switchMap(() => this.perfis.buscar(id)),
      tap((usuario) => this.auth.atualizarUsuario(usuario)),
    );
  }
}
