import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { ROTULOS_PAPEL, descreverAcessos } from '../../core/auth/acessos';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { ProblemDetail } from '../../core/http/error.interceptor';
import { Demanda, TIPOS, URGENCIAS, rotuloDoStatus } from '../../demandas/demanda.model';
import { DemandaService } from '../../demandas/demanda.service';
import { Avatar } from '../../shared/avatar/avatar';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { MeuPerfil, PerfilService, TAMANHO_MAXIMO_AVATAR, TIPOS_DE_AVATAR } from '../perfil.service';

type Campo = 'nome' | 'telefone' | 'bio';

const MENSAGENS: Record<Campo, [validador: string, mensagem: string][]> = {
  nome: [
    ['required', 'O nome é obrigatório'],
    ['pattern', 'O nome é obrigatório'],
    ['maxlength', 'O nome deve ter no máximo 100 caracteres'],
  ],
  telefone: [
    ['pattern', 'Use apenas números, espaços, parênteses, + e -'],
    ['maxlength', 'O telefone deve ter no máximo 20 caracteres'],
  ],
  bio: [['maxlength', 'A bio deve ter no máximo 500 caracteres']],
};

function textoOuNulo(valor: string): string | null {
  return valor.trim() || null;
}

@Component({
  selector: 'app-meu-perfil',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    Avatar,
    Skeleton,
  ],
  templateUrl: './meu-perfil.html',
  styleUrl: './meu-perfil.scss',
})
export class MeuPerfilPage implements OnInit {
  private readonly perfilService = inject(PerfilService);
  private readonly demandaService = inject(DemandaService);
  private readonly auth = inject(AuthService);
  private readonly notificacao = inject(Notificacao);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly temDemandas = this.auth.podeAcessar('demandas');
  protected readonly urgencias = URGENCIAS;
  protected readonly tipos = TIPOS;
  protected readonly rotuloDoStatus = rotuloDoStatus;
  protected readonly tiposAceitos = TIPOS_DE_AVATAR.join(',');
  protected readonly rotulosPapel = ROTULOS_PAPEL;

  protected readonly perfil = signal<MeuPerfil | null>(null);
  protected readonly erroAoCarregar = signal(false);
  protected readonly salvando = signal(false);
  protected readonly enviandoFoto = signal(false);
  protected readonly tarefas = signal<Demanda[] | null>(null);
  protected readonly erroNasTarefas = signal(false);

  protected readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    telefone: ['', [Validators.maxLength(20), Validators.pattern(/^[0-9()+\-\s]*$/)]],
    bio: ['', [Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.carregar();
    if (this.temDemandas) {
      this.carregarTarefas();
    }
  }

  protected carregar(): void {
    this.erroAoCarregar.set(false);
    this.perfilService
      .buscar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (perfil) => this.aplicar(perfil),
        error: () => this.erroAoCarregar.set(true),
      });
  }

  protected carregarTarefas(): void {
    this.erroNasTarefas.set(false);
    this.demandaService
      .listar({ responsavel: 'me', abertas: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (demandas) => this.tarefas.set(demandas),
        error: () => this.erroNasTarefas.set(true),
      });
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valor = this.form.getRawValue();
    this.salvando.set(true);
    this.perfilService
      .atualizar({
        nome: valor.nome.trim(),
        telefone: textoOuNulo(valor.telefone),
        bio: textoOuNulo(valor.bio),
      })
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (perfil) => {
          this.aplicar(perfil);
          this.notificacao.sucesso('Perfil atualizado.');
        },
        error: (erro: HttpErrorResponse) => {
          (erro.error as ProblemDetail | null)?.erros?.forEach(({ campo, mensagem }) =>
            this.form.get(campo)?.setErrors({ api: mensagem }),
          );
          this.form.markAllAsTouched();
        },
      });
  }

  /** A API confere o conteúdo do arquivo; aqui só se evita enviar o que já se sabe que será recusado. */
  protected escolherFoto(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    campo.value = '';
    if (!arquivo) {
      return;
    }
    if (!TIPOS_DE_AVATAR.includes(arquivo.type)) {
      this.notificacao.erro('Escolha uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_AVATAR) {
      this.notificacao.erro('A imagem deve ter no máximo 2 MB.');
      return;
    }
    this.trocarFoto(this.perfilService.enviarAvatar(arquivo), 'Foto atualizada.');
  }

  protected removerFoto(): void {
    this.trocarFoto(this.perfilService.removerAvatar(), 'Foto removida.');
  }

  protected acessos(perfil: MeuPerfil): string {
    return descreverAcessos(perfil);
  }

  protected progresso(demanda: Demanda): string | null {
    const total = demanda.checklist.length;
    return total ? `${demanda.checklist.filter((i) => i.feito).length}/${total}` : null;
  }

  protected mensagemDeErro(campo: Campo): string {
    const erros = this.form.controls[campo].errors;
    if (!erros) {
      return '';
    }
    return erros['api'] ?? MENSAGENS[campo].find(([validador]) => erros[validador])?.[1] ?? 'Valor inválido';
  }

  private trocarFoto(requisicao: Observable<MeuPerfil>, mensagem: string): void {
    this.enviandoFoto.set(true);
    requisicao
      .pipe(
        finalize(() => this.enviandoFoto.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((perfil) => {
        this.aplicar(perfil, false);
        this.notificacao.sucesso(mensagem);
      });
  }

  /** Atualiza a tela e a sessão, para o topo do painel mostrar o mesmo nome e foto. */
  private aplicar(perfil: MeuPerfil, preencherFormulario = true): void {
    this.perfil.set(perfil);
    if (preencherFormulario) {
      this.form.reset({
        nome: perfil.nome,
        telefone: perfil.telefone ?? '',
        bio: perfil.bio ?? '',
      });
    }
    const { telefone, bio, ...usuario } = perfil;
    this.auth.atualizarUsuario(usuario);
  }
}
