import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { Marca } from '../shared/marca/marca';
import { CandidaturaForm } from './candidatura-form';
import { ErroPublico, PublicoService, VagaPublica } from './publico.service';

const MODALIDADES: Record<string, string> = { PRESENCIAL: 'Presencial', REMOTO: 'Remoto', HIBRIDO: 'Híbrido' };

/** Vagas abertas ao público e candidatura sem login. */
@Component({
  selector: 'app-trabalhe-conosco',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, Marca, CandidaturaForm],
  template: `
    <main class="pagina">
      <div class="cartao">
        <app-marca class="marca" />
        @if (carregando()) {
          <div class="centro"><mat-spinner diameter="40" /></div>
        } @else if (enviado()) {
          <div class="centro">
            <mat-icon class="grande ok">check_circle</mat-icon>
            <h1>Candidatura enviada!</h1>
            <p>Obrigado pelo interesse. Entraremos em contato.</p>
            <button mat-button type="button" (click)="voltar()">Ver outras vagas</button>
          </div>
        } @else if (vaga(); as v) {
          <button mat-button type="button" (click)="voltar()">
            <mat-icon>arrow_back</mat-icon>
            Todas as vagas
          </button>
          <h1>{{ v.titulo }}</h1>
          <p class="detalhe">{{ descrever(v) }}</p>
          @if (v.descricao) {
            <p class="observacoes">{{ v.descricao }}</p>
          }
          @if (v.requisitos) {
            <h2>Requisitos</h2>
            <p class="observacoes">{{ v.requisitos }}</p>
          }
          <h2>Candidate-se</h2>
          <app-candidatura-form [vagaId]="v.id" (enviado)="enviado.set(true)" />
        } @else {
          <h1>Trabalhe conosco</h1>
          @if (erro()) {
            <p class="erro">{{ erro() }}</p>
          } @else if (!vagas().length) {
            <p class="detalhe">Não há vagas abertas no momento.</p>
          } @else {
            <ul class="vagas">
              @for (v of vagas(); track v.id) {
                <li>
                  <strong>{{ v.titulo }}</strong>
                  <p class="detalhe">{{ descrever(v) }}</p>
                  <button mat-stroked-button type="button" (click)="escolhida.set(v.id)">Ver vaga</button>
                </li>
              }
            </ul>
          }
        }
      </div>
    </main>
  `,
  styleUrl: './publico.scss',
})
export class TrabalheConosco implements OnInit {
  private readonly publico = inject(PublicoService);
  private readonly route = inject(ActivatedRoute);

  protected readonly carregando = signal(true);
  protected readonly vagas = signal<VagaPublica[]>([]);
  protected readonly escolhida = signal<string | null>(this.route.snapshot.queryParamMap.get('vaga'));
  protected readonly enviado = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly vaga = computed(() => this.vagas().find((v) => v.id === this.escolhida()) ?? null);

  async ngOnInit(): Promise<void> {
    try {
      this.vagas.set(await this.publico.vagasAbertas());
    } catch (e) {
      this.erro.set(e instanceof ErroPublico ? e.message : 'Não foi possível carregar as vagas.');
    } finally {
      this.carregando.set(false);
    }
  }

  protected descrever(v: VagaPublica): string {
    return [v.departamento, v.local, MODALIDADES[v.modalidade] ?? v.modalidade, v.tipoContrato].filter(Boolean).join(' · ');
  }

  protected voltar(): void {
    this.escolhida.set(null);
    this.enviado.set(false);
  }
}
