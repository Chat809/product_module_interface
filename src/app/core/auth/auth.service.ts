import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Sessao, Usuario } from './auth.model';

const CHAVE_SESSAO = 'painel.sessao';

function lerSessaoGuardada(): Sessao | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as Sessao) : null;
  } catch {
    return null;
  }
}

/** Sessão do usuário. O painel só conversa com a API; quem fala com o Supabase é o backend. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly url = `${environment.apiUrl}/auth`;

  private readonly sessao = signal<Sessao | null>(lerSessaoGuardada());
  private renovacaoEmAndamento: Observable<Sessao> | null = null;
  private apiAcordada = false;

  readonly usuario = computed(() => this.sessao()?.usuario ?? null);
  readonly logado = computed(() => this.sessao() !== null);
  readonly ehAdmin = computed(() => this.usuario()?.papel === 'ADMIN');

  /**
   * Dispara o despertar da API enquanto o usuário preenche o formulário. O modo `no-cors`
   * dispensa CORS no health check; a resposta opaca não importa, só a chegada da requisição.
   */
  acordarApi(): void {
    if (this.apiAcordada) {
      return;
    }
    this.apiAcordada = true;
    const health = environment.apiUrl.replace(/\/api\/v1$/, '/actuator/health');
    fetch(health, { mode: 'no-cors', cache: 'no-store' }).catch(() => (this.apiAcordada = false));
  }

  token(): string | null {
    return this.sessao()?.accessToken ?? null;
  }

  entrar(email: string, senha: string): Observable<Usuario> {
    return this.http.post<Sessao>(`${this.url}/login`, { email, senha }).pipe(
      tap((sessao) => this.guardar(sessao)),
      map((sessao) => sessao.usuario),
    );
  }

  registrar(nome: string, email: string, senha: string): Observable<Usuario> {
    return this.http.post<Sessao>(`${this.url}/registro`, { nome, email, senha }).pipe(
      tap((sessao) => this.guardar(sessao)),
      map((sessao) => sessao.usuario),
    );
  }

  /**
   * O Supabase invalida o refresh token a cada uso, então requisições que expiram juntas
   * compartilham a mesma renovação em vez de disparar várias.
   */
  renovar(): Observable<Sessao> {
    if (!this.renovacaoEmAndamento) {
      const refreshToken = this.sessao()?.refreshToken ?? '';
      this.renovacaoEmAndamento = this.http.post<Sessao>(`${this.url}/refresh`, { refreshToken }).pipe(
        tap((sessao) => this.guardar(sessao)),
        finalize(() => (this.renovacaoEmAndamento = null)),
        shareReplay(1),
      );
    }
    return this.renovacaoEmAndamento;
  }

  sair(): void {
    this.sessao.set(null);
    localStorage.removeItem(CHAVE_SESSAO);
    this.router.navigate(['/login']);
  }

  private guardar(sessao: Sessao): void {
    this.sessao.set(sessao);
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  }
}
