import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, finalize, switchMap } from 'rxjs';
import { ACESSO_TOTAL, MODULOS, ROTULOS_PAPEL } from '../../core/auth/acessos';
import { Usuario } from '../../core/auth/auth.model';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { Avatar } from '../../shared/avatar/avatar';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { SenhaDialog } from '../senha-dialog/senha-dialog';
import { UsuarioFormData, UsuarioFormDialog } from '../usuario-form/usuario-form';
import { UsuarioService } from '../usuario.service';

@Component({
  selector: 'app-usuario-list',
  imports: [
    Avatar,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
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

  protected readonly colunas = ['nome', 'departamento', 'funcao', 'papel', 'acessos', 'criadoEm', 'acoes'];

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(0);
  protected readonly tamanhoPagina = signal(10);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

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

  protected nivel(usuario: Usuario): string {
    return ROTULOS_PAPEL[usuario.papel];
  }

  /** Rótulos dos acessos para os chips da tabela; `*` e administradores aparecem como "Acesso total". */
  protected acessos(usuario: Usuario): string[] {
    if (usuario.papel === 'ADMIN' || usuario.acessos.includes(ACESSO_TOTAL)) {
      return ['Acesso total'];
    }
    return MODULOS.filter((m) => usuario.acessos.includes(m.chave)).map((m) => m.rotulo);
  }

  protected novo(): void {
    this.dialog
      .open<UsuarioFormDialog, UsuarioFormData, Usuario>(UsuarioFormDialog, {
        data: { ehVoce: false },
        width: '560px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .pipe(filter((criado): criado is Usuario => !!criado))
      .subscribe((criado) => {
        this.notificacao.sucesso(`Usuário ${criado.nome} criado.`);
        this.carregar();
      });
  }

  /** A conta sai do login; demandas e lançamentos que ela criou ficam, sem autor. */
  protected excluir(usuario: Usuario): void {
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          titulo: 'Excluir usuário',
          mensagem: `Excluir a conta de ${usuario.nome} (${usuario.email})? A pessoa perde o acesso ao painel e a ação não pode ser desfeita.`,
          textoConfirmar: 'Excluir',
        },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.usuarioService.excluir(usuario.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.notificacao.sucesso(`Usuário ${usuario.nome} excluído.`);
        if (this.usuarios().length === 1 && this.pagina() > 0) {
          this.pagina.update((p) => p - 1);
        }
        this.carregar();
      });
  }

  protected editar(usuario: Usuario): void {
    const dialogo = this.dialog.open<UsuarioFormDialog, UsuarioFormData, Usuario>(UsuarioFormDialog, {
      data: { usuario, ehVoce: this.ehVoce(usuario) },
      width: '560px',
      maxWidth: '95vw',
    });
    dialogo.componentInstance.avatarAlterado.subscribe((salvo) => {
      this.usuarios.update((lista) =>
        lista.map((u) => (u.id === salvo.id ? { ...u, avatarUrl: salvo.avatarUrl } : u)),
      );
      this.auth.atualizarUsuario(salvo);
    });
    dialogo
      .afterClosed()
      .pipe(filter((salvo): salvo is Usuario => !!salvo))
      .subscribe((salvo) => {
        this.usuarios.update((lista) => lista.map((u) => (u.id === salvo.id ? salvo : u)));
        this.auth.atualizarUsuario(salvo);
        this.notificacao.sucesso(`Dados de ${salvo.nome} atualizados.`);
      });
  }

  protected redefinirSenha(usuario: Usuario): void {
    this.dialog
      .open<SenhaDialog, Usuario, boolean>(SenhaDialog, { data: usuario, width: '440px', maxWidth: '95vw' })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.notificacao.sucesso(`Nova senha de ${usuario.nome} definida.`));
  }
}
