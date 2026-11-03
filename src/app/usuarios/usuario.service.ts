import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Papel, Usuario } from '../core/auth/auth.model';
import { Pagina } from '../produtos/produto.model';

/** Espelha o AtualizarUsuarioRequestDTO da API. */
export interface AtualizarUsuario {
  nome: string;
  email: string;
  papel: Papel;
  acessos: string[];
  departamento: string | null;
  /** Cargo. */
  funcao: string | null;
}

/** Espelha o CriarUsuarioRequestDTO da API. */
export interface NovoUsuario extends AtualizarUsuario {
  senha: string;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/usuarios`;

  listar(pagina: number, tamanho: number): Observable<Pagina<Usuario>> {
    return this.http.get<Pagina<Usuario>>(this.url, { params: { page: pagina, size: tamanho } });
  }

  criar(dados: NovoUsuario): Observable<Usuario> {
    return this.http.post<Usuario>(this.url, dados);
  }

  atualizar(id: string, dados: AtualizarUsuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.url}/${id}`, dados);
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  redefinirSenha(id: string, senha: string): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}/senha`, { senha });
  }

  enviarAvatar(id: string, arquivo: File): Observable<Usuario> {
    const corpo = new FormData();
    corpo.append('arquivo', arquivo);
    return this.http.put<Usuario>(`${this.url}/${id}/avatar`, corpo);
  }

  removerAvatar(id: string): Observable<Usuario> {
    return this.http.delete<Usuario>(`${this.url}/${id}/avatar`);
  }
}
