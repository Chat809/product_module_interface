import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Papel, Usuario } from '../core/auth/auth.model';
import { Pagina } from '../produtos/produto.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/usuarios`;

  listar(pagina: number, tamanho: number): Observable<Pagina<Usuario>> {
    return this.http.get<Pagina<Usuario>>(this.url, { params: { page: pagina, size: tamanho } });
  }

  alterarPapel(id: string, papel: Papel): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.url}/${id}/papel`, { papel });
  }
}
