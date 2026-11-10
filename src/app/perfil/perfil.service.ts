import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { Papel } from '../core/auth/auth.model';
import { AuthService, COLUNAS_DO_PERFIL } from '../core/auth/auth.service';
import { enviarAvatar, removerAvatar } from '../core/supabase/avatares';
import { SupabaseService } from '../core/supabase/supabase.service';

/** Perfil da pessoa logada (`perfis`). */
export interface MeuPerfil {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  acessos: string[];
  criadoEm: string | null;
  telefone: string | null;
  /** Cargo, somente leitura. */
  funcao: string | null;
  bio: string | null;
  avatarUrl: string | null;
  departamento: string | null;
}

/** E-mail, nível, acessos, departamento e cargo ficam com o administrador (o banco só libera estas colunas). */
export interface AtualizarMeuPerfil {
  nome: string;
  telefone: string | null;
  bio: string | null;
}

export const TIPOS_DE_AVATAR = ['image/png', 'image/jpeg', 'image/webp'];
export const TAMANHO_MAXIMO_AVATAR = 2 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class PerfilService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private get id(): string {
    return this.auth.usuario()?.id ?? '';
  }

  buscar(silencioso = false): Observable<MeuPerfil> {
    return this.supabase.executar<MeuPerfil>(
      () => this.supabase.cliente.from('perfis').select(COLUNAS_DO_PERFIL).eq('id', this.id).single(),
      { silencioso },
    );
  }

  atualizar(dados: AtualizarMeuPerfil): Observable<MeuPerfil> {
    return this.supabase
      .executar<MeuPerfil>(() =>
        this.supabase.cliente
          .from('perfis')
          .update({ nome: dados.nome.trim(), telefone: dados.telefone, bio: dados.bio })
          .eq('id', this.id)
          .select(COLUNAS_DO_PERFIL)
          .single(),
      )
      .pipe(tap((perfil) => this.auth.atualizarUsuario(perfil)));
  }

  enviarAvatar(arquivo: File): Observable<MeuPerfil> {
    return enviarAvatar(this.supabase, this.id, arquivo, this.auth.usuario()?.avatarUrl).pipe(
      switchMap(() => this.buscar()),
      tap((perfil) => this.auth.atualizarUsuario(perfil)),
    );
  }

  removerAvatar(): Observable<MeuPerfil> {
    return removerAvatar(this.supabase, this.id, this.auth.usuario()?.avatarUrl).pipe(
      switchMap(() => this.buscar()),
      tap((perfil) => this.auth.atualizarUsuario(perfil)),
    );
  }
}
