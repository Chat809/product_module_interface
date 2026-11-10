import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ErroPublico, PublicoService, lerComoBase64 } from './publico.service';

const LIMITE_CURRICULO = 5 * 1024 * 1024;

/** Formulário de candidatura; serve ao link de vaga (`token`) e à página Trabalhe conosco (`vagaId`). */
@Component({
  selector: 'app-candidatura-form',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <form class="formulario" (ngSubmit)="enviar()" autocomplete="on">
      <mat-form-field appearance="outline">
        <mat-label>Nome completo</mat-label>
        <input matInput name="nome" required maxlength="150" [(ngModel)]="dados.nome" autocomplete="name" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>E-mail</mat-label>
        <input matInput name="email" type="email" required maxlength="254" [(ngModel)]="dados.email" autocomplete="email" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Telefone</mat-label>
        <input matInput name="telefone" maxlength="30" [(ngModel)]="dados.telefone" autocomplete="tel" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Cidade</mat-label>
        <input matInput name="cidade" maxlength="100" [(ngModel)]="dados.cidade" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>LinkedIn</mat-label>
        <input matInput name="linkedin" maxlength="300" [(ngModel)]="dados.linkedinUrl" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Portfólio</mat-label>
        <input matInput name="portfolio" maxlength="300" [(ngModel)]="dados.portfolioUrl" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="inteiro">
        <mat-label>Conte um pouco sobre você</mat-label>
        <textarea matInput name="resumo" rows="4" maxlength="3000" [(ngModel)]="dados.resumo"></textarea>
      </mat-form-field>
      <input class="isca" name="site" tabindex="-1" autocomplete="off" aria-hidden="true" [(ngModel)]="isca" />
      <div class="inteiro curriculo">
        <input #arquivo type="file" accept="application/pdf" hidden (change)="escolher(arquivo)" />
        <button mat-stroked-button type="button" (click)="arquivo.click()">
          <mat-icon>attach_file</mat-icon>
          {{ curriculo() ? curriculo()!.name : 'Anexar currículo (PDF, até 5 MB)' }}
        </button>
      </div>
      <mat-checkbox class="inteiro" name="consentimento" [(ngModel)]="consentimento">
        Autorizo o uso dos meus dados para este processo seletivo.
      </mat-checkbox>
      @if (erro()) {
        <p class="erro inteiro">{{ erro() }}</p>
      }
      <button mat-flat-button type="submit" class="inteiro" [disabled]="enviando()">
        {{ enviando() ? 'Enviando...' : 'Enviar candidatura' }}
      </button>
    </form>
  `,
  styles: `
    .formulario {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 16px;
      row-gap: 4px;
    }

    .inteiro {
      grid-column: 1 / -1;
    }

    .curriculo {
      margin-bottom: 12px;
    }

    .isca {
      position: absolute;
      left: -9999px;
    }

    .erro {
      color: var(--mat-sys-error);
    }

    @media (max-width: 600px) {
      .formulario {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CandidaturaForm {
  private readonly publico = inject(PublicoService);

  readonly token = input<string | null>(null);
  readonly vagaId = input<string | null>(null);
  readonly enviado = output<void>();

  protected dados = { nome: '', email: '', telefone: '', cidade: '', linkedinUrl: '', portfolioUrl: '', resumo: '' };
  protected consentimento = false;
  protected isca = '';
  protected readonly curriculo = signal<File | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected escolher(seletor: HTMLInputElement): void {
    const arquivo = seletor.files?.[0] ?? null;
    seletor.value = '';
    if (arquivo && (arquivo.type !== 'application/pdf' || arquivo.size > LIMITE_CURRICULO)) {
      this.erro.set('Envie o currículo em PDF, com até 5 MB.');
      return;
    }
    this.erro.set(null);
    this.curriculo.set(arquivo);
  }

  protected async enviar(): Promise<void> {
    if (this.dados.nome.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.dados.email.trim())) {
      this.erro.set('Informe seu nome e um e-mail válido.');
      return;
    }
    if (!this.consentimento) {
      this.erro.set('É preciso autorizar o uso dos seus dados para a seleção.');
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const arquivo = this.curriculo();
      const base64 = arquivo ? await lerComoBase64(arquivo) : null;
      const dados = { ...this.dados, consentimento: true };
      if (this.token()) {
        await this.publico.responder(this.token()!, dados, base64, this.isca);
      } else {
        await this.publico.candidatar(this.vagaId()!, dados, base64, this.isca);
      }
      this.enviado.emit();
    } catch (e) {
      this.erro.set(e instanceof ErroPublico ? e.message : 'Não foi possível enviar. Tente novamente.');
    } finally {
      this.enviando.set(false);
    }
  }
}
