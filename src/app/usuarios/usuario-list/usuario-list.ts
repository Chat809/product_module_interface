import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, finalize, switchMap } from 'rxjs';
import { Papel, Usuario } from '../../core/auth/auth.model';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { UsuarioService } from '../usuario.service';

export const ROTULOS_PAPEL: Record<Papel, string> = {
  ADMIN: 'Administrador',
  USUARIO: 'Usuário',
};

@Component({
  selector: 'app-usuario-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    Skeleton,
  ],
  templateUrl: './usuario-list.html',
  styleUrl: './usuario-list.scss',
})
export class UsuarioList implements OnInit {
  private readonly usuarioService = inject(UsuarioService);
  private readonly notificacao = inject(Notificacao);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  protected readonly colunas = ['nome', 'email', 'papel', 'criadoEm'];
  protected readonly papeis: Papel[] = ['USUARIO', 'ADMIN'];
  protected readonly rotulos = ROTULOS_PAPEL;

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(0);
  protected readonly tamanhoPagina = signal(10);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);
  protected readonly alterando = signal<string | null>(null);

  ngOnInit(): void {
    this.carregar();
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.erro.set(false);
    this.usuarioService
      .listar(this.pagina(), this.tamanhoPagina())
      .pipe(
        finalize(() => this.carregando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (pagina) => {
          this.usuarios.set(pagina.conteudo);
          this.total.set(pagina.totalElementos);
        },
        error: () => this.erro.set(true),
      });
  }

  protected mudarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
    this.tamanhoPagina.set(evento.pageSize);
    this.carregar();
  }

  protected ehVoce(usuario: Usuario): boolean {
    return usuario.id === this.auth.usuario()?.id;
  }

  /** Pede confirmação; se cancelar, recria as linhas para o select voltar ao papel atual. */
  protected alterarPapel(usuario: Usuario, papel: Papel): void {
    const promovendo = papel === 'ADMIN';
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          titulo: promovendo ? 'Tornar administrador?' : 'Remover acesso de administrador?',
          mensagem: promovendo
            ? `${usuario.nome} poderá ver todos os usuários e alterar papéis.`
            : `${usuario.nome} continuará usando o painel, mas sem gerenciar usuários.`,
          textoConfirmar: promovendo ? 'Tornar administrador' : 'Remover acesso',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmado) => {
          if (!confirmado) {
            this.usuarios.update((lista) => lista.map((u) => ({ ...u })));
          }
          return confirmado === true;
        }),
        switchMap(() => {
          this.alterando.set(usuario.id);
          return this.usuarioService.alterarPapel(usuario.id, papel).pipe(finalize(() => this.alterando.set(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (atualizado) => {
          this.usuarios.update((lista) => lista.map((u) => (u.id === atualizado.id ? atualizado : u)));
          this.notificacao.sucesso(`${atualizado.nome} agora é ${ROTULOS_PAPEL[atualizado.papel].toLowerCase()}.`);
        },
        error: () => this.carregar(),
      });
  }
}
