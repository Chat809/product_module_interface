import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, finalize } from 'rxjs';
import { ACESSO_TOTAL, MODULOS } from '../../core/auth/acessos';
import { Usuario } from '../../core/auth/auth.model';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { SenhaDialog } from '../senha-dialog/senha-dialog';
import { ROTULOS_PAPEL, UsuarioFormData, UsuarioFormDialog } from '../usuario-form/usuario-form';
import { UsuarioService } from '../usuario.service';

@Component({
  selector: 'app-usuario-list',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatPaginatorModule, MatTableModule, MatTooltipModule, Skeleton],
  templateUrl: './usuario-list.html',
  styleUrl: './usuario-list.scss',
})
export class UsuarioList implements OnInit {
  private readonly usuarioService = inject(UsuarioService);
  private readonly notificacao = inject(Notificacao);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  protected readonly colunas = ['nome', 'email', 'papel', 'acessos', 'criadoEm', 'acoes'];

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

  protected cargo(usuario: Usuario): string {
    return ROTULOS_PAPEL[usuario.papel];
  }

  /** Rótulos dos acessos para os chips da tabela; `*` e administradores aparecem como "Acesso total". */
  protected acessos(usuario: Usuario): string[] {
    if (usuario.papel === 'ADMIN' || usuario.acessos.includes(ACESSO_TOTAL)) {
      return ['Acesso total'];
    }
    return MODULOS.filter((m) => usuario.acessos.includes(m.chave)).map((m) => m.rotulo);
  }

  protected editar(usuario: Usuario): void {
    this.dialog
      .open<UsuarioFormDialog, UsuarioFormData, Usuario>(UsuarioFormDialog, {
        data: { usuario, ehVoce: this.ehVoce(usuario) },
        width: '520px',
        maxWidth: '95vw',
      })
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
