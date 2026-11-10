import { NgComponentOutlet } from '@angular/common';
import { Component, OnInit, Type, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { Notificacao } from '../core/feedback/notificacao.service';
import { SupabaseService } from '../core/supabase/supabase.service';
import { DialogosCadastro } from '../shared/formulario-cadastro/dialogos-cadastro.service';
import { Skeleton } from '../shared/skeleton/skeleton';
import { OpcoesService } from './opcoes.service';
import { TELAS } from './registro';
import { TelaLista } from './tela-lista';
import { AbaTela, ContextoTela, DefinicaoLista } from './tela.model';

interface AbaPronta {
  rotulo: string;
  lista?: DefinicaoLista;
  componente?: Type<unknown>;
}

/** Página das telas declaradas em `registro.ts`; a rota informa qual (`data.tela`). Várias abas viram guias. */
@Component({
  selector: 'app-pagina-telas',
  imports: [MatTabsModule, NgComponentOutlet, Skeleton, TelaLista],
  template: `
    @if (abas(); as abas) {
      @if (abas.length === 1) {
        @if (abas[0].lista; as lista) {
          <app-tela-lista [def]="lista" [ctx]="ctx" />
        } @else {
          <ng-container *ngComponentOutlet="abas[0].componente!" />
        }
      } @else {
        <mat-tab-group animationDuration="0ms" mat-stretch-tabs="false" class="guias">
          @for (aba of abas; track aba.rotulo) {
            <mat-tab [label]="aba.rotulo">
              <ng-template matTabContent>
                <div class="conteudo">
                  @if (aba.lista; as lista) {
                    <app-tela-lista [def]="lista" [ctx]="ctx" />
                  } @else {
                    <ng-container *ngComponentOutlet="aba.componente!" />
                  }
                </div>
              </ng-template>
            </mat-tab>
          }
        </mat-tab-group>
      }
    } @else {
      <app-skeleton [linhas]="6" />
    }
  `,
  styles: `
    .guias {
      margin-top: -8px;
    }

    .conteudo {
      padding-top: 20px;
    }
  `,
})
export class PaginaTelas implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly opcoes = inject(OpcoesService);
  private readonly pessoas = new Map<string, string>();

  protected readonly abas = signal<AbaPronta[] | null>(null);
  protected readonly ctx: ContextoTela = {
    supabase: inject(SupabaseService),
    dialogos: inject(DialogosCadastro),
    dialog: inject(MatDialog),
    notificacao: inject(Notificacao),
    auth: inject(AuthService),
    opcoes: this.opcoes,
    nomeDoUsuario: (id) => (id ? (this.pessoas.get(id) ?? 'Usuário removido') : null),
  };

  ngOnInit(): void {
    const chave = this.route.snapshot.data['tela'] as string;
    // As colunas mostram nomes de pessoas: a lista só aparece depois de carregá-los.
    this.opcoes
      .usuarios()
      .pipe(catchError(() => of([])))
      .subscribe(async (usuarios) => {
        usuarios.forEach((u) => this.pessoas.set(u.id, u.nome));
        const fabrica = await TELAS[chave]();
        const tela = fabrica(this.ctx);
        this.abas.set(await Promise.all(tela.abas.map((aba) => this.preparar(aba))));
      });
  }

  private async preparar(aba: AbaTela): Promise<AbaPronta> {
    if (aba.tipo === 'componente') {
      return { rotulo: aba.aba, componente: await aba.componente() };
    }
    return { rotulo: aba.aba ?? aba.titulo, lista: aba };
  }
}
