import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { menuDe, podeAcessar } from './acessos';
import { ChaveSubaba, Sessao, Usuario } from './auth.model';
import { ROTA_RETORNO_GOOGLE, desafioDe, gerarVerificador, urlDoGoogle } from './google';

const CHAVE_SESSAO = 'painel.sessao';
const CHAVE_GOOGLE = 'painel.google';

interface LoginGoogle {
  verificador: string;
  voltar?: string;
}

function lerSessaoGuardada(): Sessao | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as Sessao) : null;
  } catch {
    return null;
  }
}

/**
 * Sessão do usuário. O painel só chama a API; o Supabase aparece apenas no redirecionamento do
 * login com Google, e mesmo ali a troca do código pela sessão é feita pelo backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly documento = inject(DOCUMENT);
  private readonly url = `${environment.apiUrl}/auth`;

  private readonly sessao = signal<Sessao | null>(lerSessaoGuardada());
  private renovacaoEmAndamento: Observable<Sessao> | null = null;
  private apiAcordada = false;

  readonly usuario = computed(() => this.sessao()?.usuario ?? null);
  readonly logado = computed(() => this.sessao() !== null);
  readonly ehAdmin = computed(() => this.usuario()?.papel === 'ADMIN');
  /** Módulos do menu, cada um só com as subabas que a pessoa pode abrir. */
  readonly menu = computed(() => menuDe(this.usuario()));

  podeAcessar(subaba: ChaveSubaba): boolean {
    return podeAcessar(this.usuario(), subaba);
  }

  /** Primeira subaba liberada, para onde vão a raiz e as rotas proibidas. */
  rotaInicial(): string {
    return this.menu()[0]?.subabas[0]?.rota ?? '/sem-acesso';
  }

  /** Mantém a sessão em dia quando o admin edita a própria conta na tela de usuários. */
  atualizarUsuario(usuario: Usuario): void {
    const atual = this.sessao();
    if (atual && atual.usuario.id === usuario.id) {
      this.persistir({ ...atual, usuario });
    }
  }

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
   * Leva ao Google pelo Supabase. O verificador e a rota de volta ficam no sessionStorage da aba,
   * porque a página é recarregada no retorno.
   */
  async entrarComGoogle(voltar?: string): Promise<void> {
    const verificador = gerarVerificador();
    sessionStorage.setItem(CHAVE_GOOGLE, JSON.stringify({ verificador, voltar } satisfies LoginGoogle));
    const retorno = `${this.documento.location.origin}${ROTA_RETORNO_GOOGLE}`;
    this.irPara(urlDoGoogle(await desafioDe(verificador), retorno));
  }

  /** Troca o código do retorno pela sessão. O verificador é descartado mesmo se a troca falhar: o código é de uso único. */
  concluirGoogle(codigo: string): Observable<{ usuario: Usuario; voltar?: string }> {
    const guardado = sessionStorage.getItem(CHAVE_GOOGLE);
    sessionStorage.removeItem(CHAVE_GOOGLE);
    if (!guardado) {
      return throwError(() => new Error('Login com Google não iniciado nesta aba'));
    }
    const { verificador, voltar } = JSON.parse(guardado) as LoginGoogle;
    return this.http.post<Sessao>(`${this.url}/google`, { codigo, verificador }).pipe(
      tap((sessao) => this.guardar(sessao)),
      map((sessao) => ({ usuario: sessao.usuario, voltar })),
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

  protected irPara(url: string): void {
    this.documento.location.assign(url);
  }

  /** Login e renovação não trazem foto, departamento nem cargo; eles são mantidos da sessão anterior do mesmo usuário. */
  private guardar(sessao: Sessao): void {
    const anterior = this.sessao()?.usuario;
    if (anterior?.id === sessao.usuario.id) {
      const { avatarUrl, departamento, funcao } = sessao.usuario;
      sessao = {
        ...sessao,
        usuario: {
          ...sessao.usuario,
          avatarUrl: avatarUrl ?? anterior.avatarUrl,
          departamento: departamento ?? anterior.departamento,
          funcao: funcao ?? anterior.funcao,
        },
      };
    }
    this.persistir(sessao);
  }

  private persistir(sessao: Sessao): void {
    this.sessao.set(sessao);
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  }
}
