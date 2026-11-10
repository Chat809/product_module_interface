import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { Observable, defer, from, map, switchMap } from 'rxjs';
import { ConfiguracaoService } from '../configuracao/configuracao.service';
import { paraCamel } from '../supabase/caixa';
import { erroHttp } from '../supabase/erros';
import { SupabaseService } from '../supabase/supabase.service';
import { ACESSOS_PADRAO, menuDe, podeAcessar } from './acessos';
import { ChaveSubaba, Papel, Usuario } from './auth.model';
import { ROTA_RETORNO_GOOGLE } from './google';

const CHAVE_VOLTAR_GOOGLE = 'painel.google.voltar';
export const COLUNAS_DO_PERFIL = 'id, nome, email, papel, acessos, criado_em, telefone, funcao, bio, avatar_url, departamento';

/**
 * Sessão do usuário pelo Supabase Auth. O supabase-js guarda e renova o token sozinho; aqui ficam o perfil
 * (`perfis`) e os acessos efetivos (perfil + grupos), que o banco também grava no token em `app_metadata`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly configuracao = inject(ConfiguracaoService);
  private readonly router = inject(Router);
  private readonly zona = inject(NgZone);
  private readonly documento = inject(DOCUMENT);

  private readonly atual = signal<Usuario | null>(null);

  readonly usuario = this.atual.asReadonly();
  readonly logado = computed(() => this.atual() !== null);
  readonly ehAdmin = computed(() => this.atual()?.papel === 'ADMIN');
  /** Módulos ligados do menu, cada um só com as subabas que a pessoa pode abrir. */
  readonly menu = computed(() => menuDe(this.atual(), this.configuracao.modulosLigados()));

  /** Chamado antes da primeira rota: restaura a sessão guardada e passa a acompanhar login, renovação e saída. */
  async iniciar(): Promise<void> {
    const { data } = await this.supabase.cliente.auth.getSession();
    if (data.session) {
      await this.montar(data.session).catch(() => this.atual.set(null));
    }
    this.supabase.cliente.auth.onAuthStateChange((evento, sessao) => {
      this.zona.run(() => {
        if (evento === 'SIGNED_OUT' || !sessao) {
          if (this.atual()) {
            this.atual.set(null);
            this.router.navigate(['/login']);
          }
          return;
        }
        if (evento === 'TOKEN_REFRESHED' || evento === 'USER_UPDATED') {
          const usuario = this.atual();
          if (usuario && usuario.id === sessao.user.id) {
            this.atual.set({ ...usuario, ...this.doToken(sessao.user) });
          }
        }
      });
    });
  }

  /** Exige a subaba liberada e o módulo ligado em `modulos_ativos`. */
  podeAcessar(subaba: ChaveSubaba): boolean {
    return podeAcessar(this.atual(), subaba) && this.menu().some((m) => m.subabas.some((s) => s.chave === subaba));
  }

  /** Primeira subaba liberada, para onde vão a raiz e as rotas proibidas. */
  rotaInicial(): string {
    return this.menu()[0]?.subabas[0]?.rota ?? '/sem-acesso';
  }

  /** Mantém o topo em dia quando a pessoa edita o próprio perfil ou o admin edita a própria conta. */
  atualizarUsuario(usuario: Partial<Usuario> & { id: string }): void {
    const atual = this.atual();
    if (atual && atual.id === usuario.id) {
      this.atual.set({ ...atual, ...usuario, acessos: atual.acessos });
    }
  }

  entrar(email: string, senha: string): Observable<Usuario> {
    return this.autenticar(() => this.supabase.cliente.auth.signInWithPassword({ email, password: senha }));
  }

  /** O perfil é criado pelo gatilho do banco com o nome dos metadados. */
  registrar(nome: string, email: string, senha: string): Observable<Usuario> {
    return this.autenticar(() =>
      this.supabase.cliente.auth.signUp({
        email,
        password: senha,
        options: { data: { nome }, emailRedirectTo: `${this.documento.location.origin}/login` },
      }),
    );
  }

  /** Leva ao Google; a rota de volta fica no sessionStorage da aba, porque a página é recarregada no retorno. */
  async entrarComGoogle(voltar?: string): Promise<void> {
    if (voltar) {
      sessionStorage.setItem(CHAVE_VOLTAR_GOOGLE, voltar);
    } else {
      sessionStorage.removeItem(CHAVE_VOLTAR_GOOGLE);
    }
    const { error } = await this.supabase.cliente.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${this.documento.location.origin}${ROTA_RETORNO_GOOGLE}` },
    });
    if (error) {
      throw error;
    }
  }

  /** Troca o código do retorno pela sessão (o verificador PKCE foi guardado pelo supabase-js). */
  concluirGoogle(codigo: string): Observable<{ usuario: Usuario; voltar?: string }> {
    const voltar = sessionStorage.getItem(CHAVE_VOLTAR_GOOGLE) ?? undefined;
    sessionStorage.removeItem(CHAVE_VOLTAR_GOOGLE);
    return this.autenticar(() => this.supabase.cliente.auth.exchangeCodeForSession(codigo)).pipe(
      map((usuario) => ({ usuario, voltar })),
    );
  }

  sair(): void {
    this.atual.set(null);
    this.supabase.cliente.auth.signOut().finally(() => this.router.navigate(['/login']));
  }

  private autenticar(
    chamada: () => Promise<{ data: { session: Session | null }; error: unknown }>,
  ): Observable<Usuario> {
    return defer(() => from(chamada())).pipe(
      switchMap(({ data, error }) => {
        if (error) {
          throw this.supabase.falha(error, { autenticacao: true });
        }
        if (!data.session) {
          throw this.supabase.falha(
            erroHttp(401, 'Conta criada. Confirme o seu e-mail pelo link enviado e depois entre.'),
            { autenticacao: true },
          );
        }
        return from(this.montar(data.session));
      }),
    );
  }

  private doToken(usuario: User): Pick<Usuario, 'papel' | 'acessos'> {
    const metadados = usuario.app_metadata ?? {};
    return {
      papel: (metadados['papel'] as Papel | undefined) ?? 'USUARIO',
      acessos: (metadados['acessos'] as string[] | undefined) ?? ACESSOS_PADRAO,
    };
  }

  /** Junta o token (acessos efetivos) e o perfil (nome, foto, cargo); se o perfil falhar, fica o que o token tem. */
  private async montar(sessao: Session): Promise<Usuario> {
    const doToken = this.doToken(sessao.user);
    const { data } = await this.supabase.cliente.from('perfis').select(COLUNAS_DO_PERFIL).eq('id', sessao.user.id).maybeSingle();
    const perfil = data ? paraCamel<Usuario>(data) : null;
    const usuario: Usuario = {
      id: sessao.user.id,
      email: perfil?.email ?? sessao.user.email ?? '',
      nome: perfil?.nome ?? (sessao.user.user_metadata?.['nome'] as string | undefined) ?? sessao.user.email ?? '',
      criadoEm: perfil?.criadoEm ?? sessao.user.created_at ?? null,
      avatarUrl: perfil?.avatarUrl ?? null,
      departamento: perfil?.departamento ?? null,
      funcao: perfil?.funcao ?? null,
      telefone: perfil?.telefone ?? null,
      bio: perfil?.bio ?? null,
      papel: perfil?.papel ?? doToken.papel,
      acessos: doToken.acessos,
    };
    this.atual.set(usuario);
    return usuario;
  }
}
