import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, filter, switchMap } from 'rxjs';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { CrmOrigem } from '../../crm/crm.model';
import { CrmService } from '../../crm/crm.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { DialogosCadastro } from '../../shared/formulario-cadastro/dialogos-cadastro.service';
import { CampoCadastro } from '../../shared/formulario-cadastro/formulario-cadastro';
import { Skeleton } from '../../shared/skeleton/skeleton';
import {
  DESCRICAO_DOS_EVENTOS,
  WebhookEntrada,
  WebhookEntrega,
  WebhookSaida,
  WebhookService,
  enderecoDeEntrada,
} from './webhook.service';

/** Valor mostrado uma única vez logo após criar ou regenerar. */
interface Revelado {
  titulo: string;
  valor: string;
  explicacao: string;
}

/** Configurações > Webhooks: avisos para outros sistemas (saída), recebimento de leads (entrada) e log. */
@Component({
  selector: 'app-webhooks',
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    Skeleton,
  ],
  templateUrl: './webhooks.html',
  styleUrl: './webhooks.scss',
})
export class Webhooks implements OnInit {
  private readonly service = inject(WebhookService);
  private readonly crm = inject(CrmService);
  private readonly dialogos = inject(DialogosCadastro);
  private readonly dialog = inject(MatDialog);
  private readonly notificacao = inject(Notificacao);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly descricoes = DESCRICAO_DOS_EVENTOS;
  protected readonly endereco = enderecoDeEntrada;
  protected readonly saidas = signal<WebhookSaida[] | null>(null);
  protected readonly entradas = signal<WebhookEntrada[] | null>(null);
  protected readonly entregas = signal<WebhookEntrega[] | null>(null);
  protected readonly totalEntregas = signal(0);
  protected readonly paginaEntregas = signal(0);
  protected readonly filtroWebhook = signal<string | null>(null);
  protected readonly filtroSucesso = signal<boolean | null>(null);
  protected readonly revelado = signal<Revelado | null>(null);
  protected readonly testando = signal<string | null>(null);
  protected readonly aberta = signal<string | null>(null);
  private eventos: string[] = [];
  private origens: CrmOrigem[] = [];

  ngOnInit(): void {
    this.service
      .eventos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((eventos) => (this.eventos = eventos));
    this.crm
      .origens()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((origens) => (this.origens = origens));
    this.carregarSaidas();
    this.carregarEntradas();
    this.carregarEntregas();
  }

  protected nomeDoWebhook(id: string): string {
    return this.saidas()?.find((w) => w.id === id)?.nome ?? 'Webhook excluído';
  }

  protected editarSaida(webhook?: WebhookSaida): void {
    const campos: CampoCadastro[] = [
      { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 100 },
      {
        chave: 'url',
        rotulo: 'URL de destino',
        obrigatorio: true,
        max: 500,
        padrao: /^https:\/\/\S+$/,
        mensagemPadrao: 'Use um endereço https://',
        dica: 'Recebe um POST com JSON e o cabeçalho X-Tribo-Assinatura',
      },
      {
        chave: 'eventos',
        rotulo: 'Eventos',
        tipo: 'multipla',
        obrigatorio: true,
        opcoes: this.eventos.map((e) => ({ valor: e, rotulo: this.descricoes[e] ?? e })),
      },
      { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle' },
    ];
    this.dialogos
      .formulario(
        {
          titulo: webhook ? 'Editar webhook de saída' : 'Novo webhook de saída',
          campos,
          valores: webhook ? { ...webhook } : undefined,
          salvar: (dados) => this.service.salvarSaida(webhook?.id ?? null, dados),
        },
        webhook ? 'Webhook atualizado.' : 'Webhook criado.',
      )
      .subscribe((salvo) => {
        this.revelarSegredo(salvo);
        this.carregarSaidas();
      });
  }

  protected regenerarSegredo(webhook: WebhookSaida): void {
    this.confirmar(
      'Gerar novo segredo?',
      `O segredo atual de "${webhook.nome}" deixa de valer na hora; o sistema de destino precisa receber o novo.`,
      'Gerar novo',
      () => this.service.regenerarSegredo(webhook.id),
    ).subscribe((salvo) => {
      this.revelarSegredo(salvo);
      this.carregarSaidas();
    });
  }

  protected testar(webhook: WebhookSaida): void {
    this.testando.set(webhook.id);
    this.service
      .testar(webhook.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entrega) => {
          this.testando.set(null);
          if (entrega.sucesso) {
            this.notificacao.sucesso(`Teste entregue (HTTP ${entrega.statusHttp}, ${entrega.duracaoMs} ms).`);
          } else {
            this.notificacao.aviso(`O teste falhou: ${entrega.erro ?? 'sem resposta'}.`);
          }
          this.carregarEntregas();
        },
        error: () => this.testando.set(null),
      });
  }

  protected excluirSaida(webhook: WebhookSaida): void {
    this.dialogos
      .excluir(`O webhook "${webhook.nome}" e o log das suas entregas`, () => this.service.excluirSaida(webhook.id))
      .subscribe(() => {
        this.carregarSaidas();
        this.carregarEntregas();
      });
  }

  protected editarEntrada(entrada?: WebhookEntrada): void {
    const campos: CampoCadastro[] = [
      { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 100, dica: 'Ex.: Formulário do site' },
      {
        chave: 'origemId',
        rotulo: 'Origem dos leads',
        tipo: 'select',
        opcoes: this.origens.filter((o) => o.ativo || o.id === entrada?.origemId).map((o) => ({ valor: o.id, rotulo: o.nome })),
      },
      { chave: 'ativo', rotulo: 'Ativo (aceita novos leads)', tipo: 'toggle' },
    ];
    this.dialogos
      .formulario(
        {
          titulo: entrada ? 'Editar webhook de entrada' : 'Novo webhook de entrada',
          campos,
          valores: entrada ? { ...entrada } : undefined,
          salvar: (dados) => this.service.salvarEntrada(entrada?.id ?? null, dados),
        },
        entrada ? 'Webhook atualizado.' : 'Webhook criado.',
      )
      .subscribe((salvo) => {
        this.revelarToken(salvo);
        this.carregarEntradas();
      });
  }

  protected regenerarToken(entrada: WebhookEntrada): void {
    this.confirmar(
      'Gerar novo endereço?',
      `O endereço atual de "${entrada.nome}" deixa de funcionar na hora; atualize-o no sistema que envia os leads.`,
      'Gerar novo',
      () => this.service.regenerarToken(entrada.id),
    ).subscribe((salvo) => {
      this.revelarToken(salvo);
      this.carregarEntradas();
    });
  }

  protected excluirEntrada(entrada: WebhookEntrada): void {
    this.dialogos
      .excluir(`O webhook de entrada "${entrada.nome}"`, () => this.service.excluirEntrada(entrada.id))
      .subscribe(() => this.carregarEntradas());
  }

  protected copiar(valor: string): void {
    navigator.clipboard.writeText(valor).then(
      () => this.notificacao.sucesso('Copiado.'),
      () => this.notificacao.erro('Não foi possível copiar; selecione o texto e copie manualmente.'),
    );
  }

  protected filtrarEntregas(webhookId: string | null, sucesso: boolean | null): void {
    this.filtroWebhook.set(webhookId);
    this.filtroSucesso.set(sucesso);
    this.paginaEntregas.set(0);
    this.carregarEntregas();
  }

  protected mudarPagina(evento: PageEvent): void {
    this.paginaEntregas.set(evento.pageIndex);
    this.carregarEntregas();
  }

  protected alternar(id: string): void {
    this.aberta.update((atual) => (atual === id ? null : id));
  }

  protected json(valor: unknown): string {
    return JSON.stringify(valor, null, 2);
  }

  protected carregarEntregas(): void {
    this.entregas.set(null);
    this.service
      .entregas({ webhookId: this.filtroWebhook(), sucesso: this.filtroSucesso() }, this.paginaEntregas(), 20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagina) => {
          this.entregas.set(pagina.conteudo);
          this.totalEntregas.set(pagina.totalElementos);
        },
        error: () => this.entregas.set([]),
      });
  }

  private revelarSegredo(webhook: WebhookSaida): void {
    if (webhook.segredoCompleto) {
      this.revelado.set({
        titulo: `Segredo de "${webhook.nome}"`,
        valor: webhook.segredo,
        explicacao:
          'Copie agora: ele não será mostrado de novo. O destino confere a assinatura calculando o HMAC-SHA256 de ' +
          '"<X-Tribo-Timestamp>.<corpo>" com este segredo e comparando com X-Tribo-Assinatura.',
      });
    }
  }

  private revelarToken(entrada: WebhookEntrada): void {
    if (entrada.tokenCompleto) {
      this.revelado.set({
        titulo: `Endereço de "${entrada.nome}"`,
        valor: enderecoDeEntrada(entrada.token),
        explicacao:
          'Copie agora: o endereço completo não será mostrado de novo. Envie um POST com JSON ' +
          '{"nome", "empresa", "email", "telefone", "valorEstimado", "mensagem"} (até 16 KB).',
      });
    }
  }

  private confirmar<T>(titulo: string, mensagem: string, textoConfirmar: string, acao: () => Observable<T>) {
    return this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data: { titulo, mensagem, textoConfirmar } })
      .afterClosed()
      .pipe(filter(Boolean), switchMap(acao));
  }

  private carregarSaidas(): void {
    this.service
      .saidas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (lista) => this.saidas.set(lista), error: () => this.saidas.set([]) });
  }

  private carregarEntradas(): void {
    this.service
      .entradas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (lista) => this.entradas.set(lista), error: () => this.entradas.set([]) });
  }
}
