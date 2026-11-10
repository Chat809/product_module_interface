import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, finalize, switchMap } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Skeleton } from '../skeleton/skeleton';

export interface Anexo {
  id: string;
  caminho: string;
  nomeOriginal: string;
  tipoMime: string | null;
  tamanhoBytes: number | null;
  enviadoPor: string | null;
  criadoEm: string;
}

const BUCKET = 'arquivos';
const LIMITE_EM_BYTES = 10 * 1024 * 1024;

/** Nome seguro para a chave do Storage, que recusa acentos e alguns símbolos. */
function nomeParaCaminho(nome: string): string {
  return (
    nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '_')
      .slice(-120) || 'arquivo'
  );
}

export function tamanhoLegivel(bytes: number | null): string {
  if (bytes === null) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Arquivos de qualquer registro, guardados no bucket privado `arquivos/{entidade}/{registro}/`.
 * Quem pode ver o registro pode ver, enviar e apagar os anexos dele (mesma regra no banco e no Storage).
 */
@Component({
  selector: 'app-painel-anexos',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTooltipModule, Skeleton],
  template: `
    @if (podeEditar()) {
      <div class="enviar">
        <input #seletor type="file" multiple hidden (change)="enviar(seletor)" />
        <button mat-stroked-button type="button" [disabled]="enviando()" (click)="seletor.click()">
          <mat-icon>upload_file</mat-icon>
          {{ enviando() ? 'Enviando...' : 'Anexar arquivos' }}
        </button>
        <span class="dica">Até 10 MB por arquivo.</span>
      </div>
    }

    @if (anexos() === null) {
      <app-skeleton [linhas]="2" />
    } @else if (anexos()!.length === 0) {
      <p class="vazio">Nenhum arquivo anexado.</p>
    } @else {
      <ul class="lista">
        @for (anexo of anexos(); track anexo.id) {
          <li>
            <mat-icon class="icone">{{ iconeDe(anexo.tipoMime) }}</mat-icon>
            <div class="nome">
              {{ anexo.nomeOriginal }}
              <span class="detalhe">
                {{ tamanho(anexo.tamanhoBytes) }} · {{ anexo.criadoEm | date: 'dd/MM/yyyy HH:mm' }}
              </span>
            </div>
            <button mat-icon-button type="button" matTooltip="Baixar" aria-label="Baixar" (click)="baixar(anexo)">
              <mat-icon>download</mat-icon>
            </button>
            @if (podeEditar()) {
              <button mat-icon-button type="button" matTooltip="Excluir" aria-label="Excluir" (click)="excluir(anexo)">
                <mat-icon>delete</mat-icon>
              </button>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .enviar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 16px 0;
    }

    .dica,
    .detalhe {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .detalhe {
      display: block;
    }

    .lista {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }

    .icone {
      color: var(--mat-sys-primary);
    }

    .nome {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .vazio {
      margin-top: 16px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class PainelAnexos implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly notificacao = inject(Notificacao);
  private readonly destroyRef = inject(DestroyRef);

  readonly entidade = input.required<string>();
  readonly registroId = input.required<string>();
  readonly podeEditar = input(true);

  protected readonly anexos = signal<Anexo[] | null>(null);
  protected readonly enviando = signal(false);
  protected readonly tamanho = tamanhoLegivel;

  ngOnInit(): void {
    this.supabase
      .executar<Anexo[]>(
        () =>
          this.supabase.cliente
            .from('arquivos_vinculados')
            .select('id, caminho, nome_original, tipo_mime, tamanho_bytes, enviado_por, criado_em')
            .eq('entidade', this.entidade())
            .eq('registro_id', this.registroId())
            .order('criado_em', { ascending: false }),
        { silencioso: true },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (lista) => this.anexos.set(lista), error: () => this.anexos.set([]) });
  }

  protected iconeDe(tipo: string | null): string {
    if (tipo?.startsWith('image/')) {
      return 'image';
    }
    if (tipo === 'application/pdf') {
      return 'picture_as_pdf';
    }
    return tipo?.includes('sheet') || tipo?.includes('excel') || tipo === 'text/csv' ? 'table_chart' : 'description';
  }

  protected enviar(seletor: HTMLInputElement): void {
    const arquivos = Array.from(seletor.files ?? []);
    seletor.value = '';
    const grandes = arquivos.filter((a) => a.size > LIMITE_EM_BYTES);
    if (grandes.length) {
      this.notificacao.aviso(`Arquivo acima de 10 MB: ${grandes.map((a) => a.name).join(', ')}.`);
    }
    const validos = arquivos.filter((a) => a.size <= LIMITE_EM_BYTES);
    if (!validos.length) {
      return;
    }
    this.enviando.set(true);
    let pendentes = validos.length;
    for (const arquivo of validos) {
      this.enviarUm(arquivo)
        .pipe(
          finalize(() => {
            pendentes -= 1;
            if (pendentes === 0) {
              this.enviando.set(false);
            }
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((anexo) => this.anexos.update((lista) => [anexo, ...(lista ?? [])]));
    }
  }

  protected baixar(anexo: Anexo): void {
    this.supabase
      .executar<{ signedUrl: string }>(() =>
        this.supabase.cliente.storage.from(BUCKET).createSignedUrl(anexo.caminho, 60, { download: anexo.nomeOriginal }),
      )
      .subscribe(({ signedUrl }) => window.open(signedUrl, '_blank', 'noopener'));
  }

  protected excluir(anexo: Anexo): void {
    this.supabase
      .executar<unknown>(() => this.supabase.cliente.storage.from(BUCKET).remove([anexo.caminho]))
      .pipe(
        switchMap(() =>
          this.supabase.executar<unknown>(() => this.supabase.cliente.from('arquivos_vinculados').delete().eq('id', anexo.id)),
        ),
      )
      .subscribe(() => {
        this.anexos.update((lista) => (lista ?? []).filter((a) => a.id !== anexo.id));
        this.notificacao.sucesso('Arquivo excluído.');
      });
  }

  private enviarUm(arquivo: File): Observable<Anexo> {
    const caminho = `${this.entidade()}/${this.registroId()}/${Date.now()}-${nomeParaCaminho(arquivo.name)}`;
    return this.supabase
      .executar<unknown>(() =>
        this.supabase.cliente.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type || undefined }),
      )
      .pipe(
        switchMap(() =>
          this.supabase.executar<Anexo>(() =>
            this.supabase.cliente
              .from('arquivos_vinculados')
              .insert({
                entidade: this.entidade(),
                registro_id: this.registroId(),
                caminho,
                nome_original: arquivo.name,
                tipo_mime: arquivo.type || null,
                tamanho_bytes: arquivo.size,
              })
              .select('id, caminho, nome_original, tipo_mime, tamanho_bytes, enviado_por, criado_em')
              .single(),
          ),
        ),
      );
  }
}
