import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Papel } from '../core/auth/auth.model';
import { SEM_AVISO_DE_ERRO } from '../core/http/error.interceptor';

/** Espelha o MeuPerfilDTO da API. */
export interface MeuPerfil {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  acessos: string[];
  criadoEm: string | null;
  telefone: string | null;
  funcao: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

/** Espelha o AtualizarMeuPerfilRequestDTO: e-mail, papel e acessos ficam com o administrador. */
export interface AtualizarMeuPerfil {
  nome: string;
  telefone: string | null;
  funcao: string | null;
  bio: string | null;
}

export const TIPOS_DE_AVATAR = ['image/png', 'image/jpeg', 'image/webp'];
export const TAMANHO_MAXIMO_AVATAR = 2 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class PerfilService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/usuarios/me`;

  buscar(silencioso = false): Observable<MeuPerfil> {
    return this.http.get<MeuPerfil>(this.url, { context: new HttpContext().set(SEM_AVISO_DE_ERRO, silencioso) });
  }

  atualizar(dados: AtualizarMeuPerfil): Observable<MeuPerfil> {
    return this.http.put<MeuPerfil>(this.url, dados);
  }

  enviarAvatar(arquivo: File): Observable<MeuPerfil> {
    const corpo = new FormData();
    corpo.append('arquivo', arquivo);
    return this.http.put<MeuPerfil>(`${this.url}/avatar`, corpo);
  }

  removerAvatar(): Observable<MeuPerfil> {
    return this.http.delete<MeuPerfil>(`${this.url}/avatar`);
  }
}
