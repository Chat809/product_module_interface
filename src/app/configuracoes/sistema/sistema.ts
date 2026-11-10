import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { concat, finalize, forkJoin, last } from 'rxjs';
import { MODULOS } from '../../core/auth/acessos';
import { ConfiguracaoService } from '../../core/configuracao/configuracao.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Skeleton } from '../../shared/skeleton/skeleton';

type Valores = Record<string, string | number | null>;

interface LinhaDeModulo {
  modulo: string;
  rotulo: string;
  ativo: boolean;
}

/** Marca, dados da empresa, parâmetros gerais e módulos ligados. Vale para todo o sistema deste cliente. */
@Component({
  selector: 'app-sistema',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule, Skeleton],
  template: `
    <header class="cabecalho">
      <div>
        <h1>Marca e módulos</h1>
        <p class="subtitulo">Nome, cores e logotipo do painel, dados da empresa e módulos que aparecem no menu.</p>
      </div>
      <button mat-flat-button type="button" [disabled]="salvando() || carregando()" (click)="salvar()">
        <mat-icon>save</mat-icon>
        {{ salvando() ? 'Salvando...' : 'Salvar' }}
      </button>
    </header>

    @if (carregando()) {
      <app-skeleton [linhas]="8" />
    } @else {
      <section class="bloco">
        <h2>Marca</h2>
        <div class="grade">
          <mat-form-field appearance="outline">
            <mat-label>Nome do sistema</mat-label>
            <input matInput maxlength="80" [(ngModel)]="marca['nome']" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Nome curto</mat-label>
            <input matInput maxlength="30" [(ngModel)]="marca['nome_curto']" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Endereço do logotipo (URL)</mat-label>
            <input matInput type="url" [(ngModel)]="marca['logo_url']" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Endereço do favicon (URL)</mat-label>
            <input matInput type="url" [(ngModel)]="marca['favicon_url']" />
          </mat-form-field>
          <div class="cor">
            <mat-slide-toggle [(ngModel)]="corPropria">Cor principal própria</mat-slide-toggle>
            @if (corPropria) {
              <input type="color" aria-label="Cor principal" [(ngModel)]="corPrimaria" />
            }
          </div>
          <div class="cor">
            <mat-slide-toggle [(ngModel)]="corSecundariaPropria">Cor de destaque própria</mat-slide-toggle>
            @if (corSecundariaPropria) {
              <input type="color" aria-label="Cor de destaque" [(ngModel)]="corSecundaria" />
            }
          </div>
        </div>
      </section>

      <section class="bloco">
        <h2>Empresa</h2>
        <div class="grade">
          <mat-form-field appearance="outline">
            <mat-label>Razão social</mat-label>
            <input matInput maxlength="150" [(ngModel)]="empresa['razao_social']" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>CNPJ ou CPF</mat-label>
            <input matInput maxlength="20" [(ngModel)]="empresa['documento']" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>E-mail</mat-label>
            <input matInput type="email" maxlength="254" [(ngModel)]="empresa['email']" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Telefone</mat-label>
            <input matInput maxlength="30" [(ngModel)]="empresa['telefone']" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Site</mat-label>
            <input matInput maxlength="200" [(ngModel)]="empresa['site']" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Endereço</mat-label>
            <input matInput maxlength="300" [(ngModel)]="empresa['endereco']" />
          </mat-form-field>
        </div>
      </section>

      <section class="bloco">
        <h2>Estoque</h2>
        <div class="grade">
          <mat-form-field appearance="outline">
            <mat-label>Alerta de estoque baixo (unidades)</mat-label>
            <input matInput type="number" min="0" [(ngModel)]="estoque['limite_baixo']" />
          </mat-form-field>
        </div>
      </section>

      <section class="bloco">
        <h2>Módulos</h2>
        <p class="subtitulo">Módulos desligados somem do menu de todos. Configurações fica sempre ligado.</p>
        <div class="modulos">
          @for (m of modulos(); track m.modulo) {
            <mat-slide-toggle [(ngModel)]="m.ativo" [disabled]="m.modulo === 'configuracoes'">{{ m.rotulo }}</mat-slide-toggle>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;

      h1 {
        margin: 0;
        font: var(--mat-sys-headline-small);
      }
    }

    .subtitulo {
      margin: 4px 0 12px;
      color: var(--mat-sys-on-surface-variant);
    }

    .bloco {
      padding: 16px 20px;
      margin-bottom: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;

      h2 {
        margin: 0 0 12px;
        font: var(--mat-sys-title-medium);
      }
    }

    .grade {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      column-gap: 16px;
    }

    .cor {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 56px;

      input {
        width: 48px;
        height: 32px;
        border: 0;
        background: none;
      }
    }

    .modulos {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
  `,
})
export class Sistema implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly configuracao = inject(ConfiguracaoService);
  private readonly notificacao = inject(Notificacao);

  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly modulos = signal<LinhaDeModulo[]>([]);
  protected marca: Valores = {};
  protected empresa: Valores = {};
  protected estoque: Valores = {};
  protected corPropria = false;
  protected corPrimaria = '#1565c0';
  protected corSecundariaPropria = false;
  protected corSecundaria = '#00897b';

  ngOnInit(): void {
    forkJoin({
      parametros: this.supabase.executar<{ chave: string; valor: Valores }[]>(() =>
        this.supabase.cliente.from('parametros_sistema').select('chave, valor').in('chave', ['marca', 'empresa', 'estoque']),
      ),
      modulos: this.supabase.executar<LinhaDeModulo[]>(() =>
        this.supabase.cliente.from('modulos_ativos').select('modulo, rotulo, ativo').order('ordem'),
      ),
    }).subscribe({
      next: ({ parametros, modulos }) => {
        const valor = (chave: string) => ({ ...(parametros.find((p) => p.chave === chave)?.valor ?? {}) });
        this.marca = valor('marca');
        this.empresa = valor('empresa');
        this.estoque = valor('estoque');
        this.corPropria = !!this.marca['cor_primaria'];
        this.corPrimaria = (this.marca['cor_primaria'] as string) || this.corPrimaria;
        this.corSecundariaPropria = !!this.marca['cor_secundaria'];
        this.corSecundaria = (this.marca['cor_secundaria'] as string) || this.corSecundaria;
        const rotulos = new Map<string, string>(MODULOS.map((m) => [m.chave, m.rotulo]));
        this.modulos.set(modulos.map((m) => ({ ...m, rotulo: rotulos.get(m.modulo) ?? m.rotulo ?? m.modulo })));
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }

  protected salvar(): void {
    if (!String(this.marca['nome'] ?? '').trim()) {
      this.notificacao.aviso('Informe o nome do sistema.');
      return;
    }
    const limpar = (valores: Valores) =>
      Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]));
    const marca = {
      ...limpar(this.marca),
      cor_primaria: this.corPropria ? this.corPrimaria : null,
      cor_secundaria: this.corSecundariaPropria ? this.corSecundaria : null,
    };
    const estoque = { ...this.estoque, limite_baixo: Math.max(0, Number(this.estoque['limite_baixo'] ?? 5)) };
    const parametro = (chave: string, valor: unknown) =>
      this.supabase.executar(() => this.supabase.cliente.from('parametros_sistema').update({ valor }).eq('chave', chave));
    const passos = [
      parametro('marca', marca),
      parametro('empresa', limpar(this.empresa)),
      parametro('estoque', estoque),
      ...this.modulos().map((m) =>
        this.supabase.executar(() =>
          this.supabase.cliente.from('modulos_ativos').update({ ativo: m.modulo === 'configuracoes' || m.ativo }).eq('modulo', m.modulo),
        ),
      ),
    ];
    this.salvando.set(true);
    concat(...passos)
      .pipe(
        last(),
        finalize(() => this.salvando.set(false)),
      )
      .subscribe(() => {
        this.configuracao.carregar();
        this.notificacao.sucesso('Configurações salvas.');
      });
  }
}
