import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { Marca } from '../shared/marca/marca';
import { CandidaturaForm } from './candidatura-form';
import { ConteudoDoLink, ErroPublico, PublicoService } from './publico.service';

const UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/** Página aberta de um link público: formulário de captação, pesquisa, proposta ou vaga. */
@Component({
  selector: 'app-pagina-publica',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    Marca,
    CandidaturaForm,
  ],
  template: `
    <main class="pagina">
      <div class="cartao">
        <app-marca class="marca" />
        @if (carregando()) {
          <div class="centro"><mat-spinner diameter="40" /></div>
        } @else if (indisponivel()) {
          <div class="centro">
            <mat-icon class="grande">link_off</mat-icon>
            <p>{{ indisponivel() }}</p>
          </div>
        } @else if (concluido()) {
          <div class="centro">
            <mat-icon class="grande ok">check_circle</mat-icon>
            <h1>Obrigado!</h1>
            <p>{{ concluido() }}</p>
          </div>
        } @else if (link(); as l) {
          <h1>{{ l.titulo }}</h1>
          @switch (l.tipo) {
            @case ('FORMULARIO_LEAD') {
              <form class="formulario" (ngSubmit)="enviarLead()">
                <mat-form-field appearance="outline">
                  <mat-label>Nome</mat-label>
                  <input matInput name="nome" required maxlength="150" [(ngModel)]="lead.nome" autocomplete="name" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Empresa</mat-label>
                  <input matInput name="empresa" maxlength="150" [(ngModel)]="lead.empresa" autocomplete="organization" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>E-mail</mat-label>
                  <input matInput name="email" type="email" maxlength="254" [(ngModel)]="lead.email" autocomplete="email" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Telefone</mat-label>
                  <input matInput name="telefone" maxlength="30" [(ngModel)]="lead.telefone" autocomplete="tel" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="inteiro">
                  <mat-label>Mensagem</mat-label>
                  <textarea matInput name="mensagem" rows="4" maxlength="2000" [(ngModel)]="lead.mensagem"></textarea>
                </mat-form-field>
                <input class="isca" name="site" tabindex="-1" autocomplete="off" aria-hidden="true" [(ngModel)]="isca" />
                @if (erro()) {
                  <p class="erro inteiro">{{ erro() }}</p>
                }
                <button mat-flat-button type="submit" class="inteiro" [disabled]="enviando()">
                  {{ enviando() ? 'Enviando...' : 'Enviar' }}
                </button>
              </form>
            }
            @case ('PESQUISA_SATISFACAO') {
              @if (l.pesquisa; as p) {
                @if (p.descricao) {
                  <p>{{ p.descricao }}</p>
                }
                <p class="pergunta">{{ p.pergunta }}</p>
                <div class="notas" role="radiogroup" [attr.aria-label]="p.pergunta">
                  @for (n of notas; track n) {
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="nota() === n"
                      [class.escolhida]="nota() === n"
                      (click)="nota.set(n)"
                    >
                      {{ n }}
                    </button>
                  }
                </div>
                <div class="extremos"><span>Nada provável</span><span>Muito provável</span></div>
                <mat-form-field appearance="outline" class="largo">
                  <mat-label>{{ p.perguntaComentario || 'Comentário (opcional)' }}</mat-label>
                  <textarea matInput rows="3" maxlength="2000" [(ngModel)]="comentario"></textarea>
                </mat-form-field>
                @if (erro()) {
                  <p class="erro">{{ erro() }}</p>
                }
                <button mat-flat-button type="button" [disabled]="enviando() || nota() === null" (click)="enviarNota()">
                  {{ enviando() ? 'Enviando...' : 'Enviar resposta' }}
                </button>
              }
            }
            @case ('PROPOSTA') {
              @if (l.proposta; as p) {
                <p class="detalhe">
                  {{ p.numero }}
                  @if (p.validade) {
                    · válida até {{ p.validade | date: 'dd/MM/yyyy' }}
                  }
                </p>
                <table class="itens">
                  <thead>
                    <tr><th>Item</th><th>Qtd.</th><th>Preço</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    @for (i of p.itens; track $index) {
                      <tr>
                        <td>{{ i.descricao }}</td>
                        <td>{{ i.quantidade }}</td>
                        <td>{{ i.precoUnitario | currency: 'BRL' }}</td>
                        <td>{{ i.valorTotal | currency: 'BRL' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
                @if (p.descontoGeral) {
                  <p class="total">Desconto: {{ p.descontoGeral | currency: 'BRL' }}</p>
                }
                <p class="total"><strong>Total: {{ p.valorTotal | currency: 'BRL' }}</strong></p>
                @if (p.condicoesPagamento) {
                  <p><strong>Pagamento:</strong> {{ p.condicoesPagamento }}</p>
                }
                @if (p.observacoes) {
                  <p class="observacoes">{{ p.observacoes }}</p>
                }
                @if (p.status === 'RASCUNHO' || p.status === 'ENVIADA') {
                  @if (recusando()) {
                    <mat-form-field appearance="outline" class="largo">
                      <mat-label>Motivo (opcional)</mat-label>
                      <textarea matInput rows="2" maxlength="300" [(ngModel)]="motivo"></textarea>
                    </mat-form-field>
                  }
                  @if (erro()) {
                    <p class="erro">{{ erro() }}</p>
                  }
                  <div class="acoes">
                    @if (!recusando()) {
                      <button mat-flat-button type="button" [disabled]="enviando()" (click)="decidir('APROVAR')">Aprovar proposta</button>
                      <button mat-button type="button" (click)="recusando.set(true)">Recusar</button>
                    } @else {
                      <button mat-flat-button type="button" [disabled]="enviando()" (click)="decidir('RECUSAR')">Confirmar recusa</button>
                      <button mat-button type="button" (click)="recusando.set(false)">Voltar</button>
                    }
                  </div>
                } @else {
                  <p class="detalhe">Esta proposta já foi {{ p.status === 'APROVADA' ? 'aprovada' : 'respondida' }}.</p>
                }
              }
            }
            @case ('VAGA') {
              @if (l.vaga; as v) {
                <p class="detalhe">{{ v.local }} · {{ v.modalidade }} · {{ v.tipoContrato }}</p>
                @if (v.descricao) {
                  <p class="observacoes">{{ v.descricao }}</p>
                }
                @if (v.requisitos) {
                  <h2>Requisitos</h2>
                  <p class="observacoes">{{ v.requisitos }}</p>
                }
                <h2>Candidate-se</h2>
                <app-candidatura-form [token]="token" (enviado)="concluido.set('Recebemos sua candidatura. Entraremos em contato.')" />
              } @else {
                <p>Esta vaga não está mais aberta.</p>
              }
            }
          }
        }
      </div>
    </main>
  `,
  styleUrl: './publico.scss',
})
export class PaginaPublica implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publico = inject(PublicoService);

  protected readonly token = this.route.snapshot.paramMap.get('token') ?? '';
  protected readonly notas = Array.from({ length: 11 }, (_, i) => i);
  protected readonly carregando = signal(true);
  protected readonly indisponivel = signal<string | null>(null);
  protected readonly concluido = signal<string | null>(null);
  protected readonly link = signal<ConteudoDoLink | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly nota = signal<number | null>(null);
  protected readonly recusando = signal(false);
  protected lead = { nome: '', empresa: '', email: '', telefone: '', mensagem: '' };
  protected comentario = '';
  protected motivo = '';
  protected isca = '';

  async ngOnInit(): Promise<void> {
    try {
      this.link.set(await this.publico.conteudo(this.token));
    } catch (e) {
      this.indisponivel.set(e instanceof ErroPublico ? e.message : 'Este link não está disponível.');
    } finally {
      this.carregando.set(false);
    }
  }

  protected enviarLead(): Promise<void> {
    if (this.lead.nome.trim().length < 2) {
      this.erro.set('Informe seu nome.');
      return Promise.resolve();
    }
    const parametros = this.route.snapshot.queryParamMap;
    const utms = Object.fromEntries(UTMS.map((u) => [u, parametros.get(u)]).filter(([, v]) => v));
    return this.enviar({ ...this.lead, ...utms }, 'Recebemos seus dados. Em breve entraremos em contato.');
  }

  protected enviarNota(): Promise<void> {
    return this.enviar({ nota: this.nota(), comentario: this.comentario }, 'Sua resposta foi registrada.');
  }

  protected decidir(decisao: 'APROVAR' | 'RECUSAR'): Promise<void> {
    return this.enviar(
      { decisao, motivo: this.motivo },
      decisao === 'APROVAR' ? 'Proposta aprovada. Vamos dar andamento ao pedido.' : 'Recebemos sua resposta.',
    );
  }

  private async enviar(dados: Record<string, unknown>, mensagem: string): Promise<void> {
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await this.publico.responder(this.token, dados, null, this.isca);
      this.concluido.set(mensagem);
    } catch (e) {
      this.erro.set(e instanceof ErroPublico ? e.message : 'Não foi possível enviar. Tente novamente.');
    } finally {
      this.enviando.set(false);
    }
  }
}
