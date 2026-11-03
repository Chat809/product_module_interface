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
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/usuarios`;

  listar(pagina: number, tamanho: number): Observable<Pagina<Usuario>> {
    return this.http.get<Pagina<Usuario>>(this.url, { params: { page: pagina, size: tamanho } });
  }

  atualizar(id: string, dados: AtualizarUsuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.url}/${id}`, dados);
  }

  redefinirSenha(id: string, senha: string): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}/senha`, { senha });
  }
}
