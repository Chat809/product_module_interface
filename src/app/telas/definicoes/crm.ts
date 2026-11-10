import { map, of, switchMap } from 'rxjs';
import { editarLinhas } from '../editor-linhas';
import { copiar, data, dataHora, linkPublico, opcoes, rotulo } from '../formatos';
import { FabricaDeTela, Registro } from '../tela.model';
import { gerarLink } from './comercial';

const TIPOS_DE_PESQUISA: Record<string, string> = { NPS: 'NPS (0 a 10)', CSAT: 'CSAT (satisfação)' };
const GATILHOS: Record<string, string> = {
  MANUAL: 'Manual',
  CLIENTE_CRIADO: 'Cliente cadastrado',
  LEAD_CONVERTIDO: 'Lead convertido',
  RECLAMACAO_RESOLVIDA: 'Reclamação resolvida',
  PEDIDO_FATURADO: 'Pedido faturado',
};
const ACOES_DE_ETAPA: Record<string, string> = { TAREFA: 'Tarefa', EMAIL: 'E-mail', WHATSAPP: 'WhatsApp', LIGACAO: 'Ligação', PESQUISA: 'Pesquisa' };
const STATUS_DO_PARTICIPANTE: Record<string, string> = { ATIVO: 'Ativo', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
const TIPOS_DE_LINK: Record<string, string> = {
  FORMULARIO_LEAD: 'Formulário de captação',
  PESQUISA_SATISFACAO: 'Pesquisa de satisfação',
  PROPOSTA: 'Proposta',
  VAGA: 'Vaga',
};

export const pesquisas: FabricaDeTela = (ctx) => ({
  abas: [
    {
      aba: 'Pesquisas',
      titulo: 'Pesquisas de satisfação',
      subtitulo: 'Gere um link para o cliente responder sem login, ou registre a resposta dada por telefone.',
      rotuloNovo: 'Nova pesquisa',
      rotuloBusca: 'Buscar pelo título',
      tabela: 'pesquisas_satisfacao',
      busca: ['titulo'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'titulo', rotulo: 'Pesquisa', valor: (p) => p['titulo'], detalhe: (p) => p['descricao'] },
        { chave: 'tipo', rotulo: 'Tipo', valor: (p) => rotulo(TIPOS_DE_PESQUISA, p['tipo']) },
      ],
      campos: [
        { chave: 'titulo', rotulo: 'Título', obrigatorio: true, max: 120, meia: true },
        { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(TIPOS_DE_PESQUISA) },
        { chave: 'descricao', rotulo: 'Texto de abertura', tipo: 'textarea', max: 500 },
        { chave: 'pergunta', rotulo: 'Pergunta da nota', obrigatorio: true, max: 300 },
        { chave: 'perguntaComentario', rotulo: 'Pergunta do comentário', max: 300 },
        { chave: 'ativo', rotulo: 'Ativa', tipo: 'toggle' },
      ],
      valoresPadrao: { tipo: 'NPS', pergunta: 'De 0 a 10, quanto você recomendaria nossa empresa a um amigo?', ativo: true },
      descrever: (p) => `A pesquisa "${p['titulo']}" e as respostas dela`,
      acoes: [
        {
          icone: 'link',
          rotulo: 'Gerar link',
          executar: (p) =>
            gerarLink(ctx, {
              tipo: 'PESQUISA_SATISFACAO',
              entidade: 'pesquisas_satisfacao',
              registro_id: p['id'],
              titulo: p['titulo'],
              configuracao: { pesquisa_id: p['id'] },
            }),
        },
        {
          icone: 'edit_note',
          rotulo: 'Registrar resposta',
          executar: (p) =>
            ctx.opcoes
              .resolver([
                { chave: 'nota', rotulo: 'Nota (0 a 10)', tipo: 'numero', obrigatorio: true, min: 0, max: 10, meia: true },
                { chave: 'clienteId', rotulo: 'Cliente', tipo: 'select', meia: true, fonte: { tabela: 'clientes', filtro: { ativo: true } } },
                { chave: 'comentario', rotulo: 'Comentário', tipo: 'textarea', max: 2000 },
              ])
              .pipe(
                switchMap((campos) =>
                  ctx.dialogos.formulario(
                    {
                      titulo: `Resposta · ${p['titulo']}`,
                      campos,
                      salvar: (d) =>
                        ctx.supabase.executar(() =>
                          ctx.supabase.cliente
                            .from('respostas_satisfacao')
                            .insert(ctx.supabase.paraSnake({ ...d, pesquisaId: p['id'], origem: 'INTERNO' }))
                            .select()
                            .single(),
                        ),
                    },
                    'Resposta registrada.',
                  ),
                ),
              ),
        },
      ],
    },
    {
      aba: 'Respostas',
      titulo: 'Respostas',
      tabela: 'respostas_satisfacao',
      selecao: '*, pesquisa:pesquisas_satisfacao(titulo), cliente:clientes(nome)',
      busca: ['comentario', 'nome', 'email'],
      rotuloBusca: 'Buscar no comentário, nome ou e-mail',
      vazio: 'Nenhuma resposta ainda.',
      colunas: [
        { chave: 'criadoEm', rotulo: 'Data', valor: (r) => data(r['criadoEm']) },
        { chave: 'pesquisa', rotulo: 'Pesquisa', valor: (r) => r['pesquisa']?.['titulo'] },
        { chave: 'nota', rotulo: 'Nota', valor: (r) => r['nota'] },
        { chave: 'pessoa', rotulo: 'Quem', valor: (r) => r['cliente']?.['nome'] ?? r['nome'] ?? 'Anônimo', detalhe: (r) => r['comentario'] },
      ],
      descrever: () => 'A resposta',
    },
    {
      aba: 'Links públicos',
      titulo: 'Links públicos',
      subtitulo: 'Formulários de captação de leads, pesquisas, propostas e vagas abertos sem login.',
      rotuloNovo: 'Novo formulário de captação',
      rotuloBusca: 'Buscar pelo título',
      tabela: 'links_publicos',
      busca: ['titulo'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'titulo', rotulo: 'Link', valor: (l) => l['titulo'], detalhe: (l) => rotulo(TIPOS_DE_LINK, l['tipo']) },
        { chave: 'usos', rotulo: 'Respostas', valor: (l) => (l['usosMaximos'] ? `${l['usos']} de ${l['usosMaximos']}` : l['usos']) },
        { chave: 'expiraEm', rotulo: 'Expira em', valor: (l) => dataHora(l['expiraEm']) ?? 'Não expira' },
      ],
      campos: [
        { chave: 'titulo', rotulo: 'Título', obrigatorio: true, max: 120 },
        { chave: 'origemId', rotulo: 'Origem dos leads', tipo: 'select', meia: true, fonte: { tabela: 'crm_origens', filtro: { ativo: true } } },
        { chave: 'usosMaximos', rotulo: 'Limite de respostas', tipo: 'numero', min: 1, meia: true },
        { chave: 'expiraEm', rotulo: 'Expira em', tipo: 'datahora', meia: true },
        { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle' },
      ],
      valoresPadrao: { ativo: true },
      paraFormulario: (l) => ({ ...l, origemId: l['configuracao']?.['origem_id'] ?? null }),
      antesDeSalvar: (d, l) => {
        const { origemId, ...resto } = d;
        return l
          ? { ...resto, configuracao: { ...(l['configuracao'] ?? {}), ...(origemId ? { origem_id: origemId } : {}) } }
          : { ...resto, tipo: 'FORMULARIO_LEAD', configuracao: origemId ? { origem_id: origemId } : {} };
      },
      descrever: (l) => `O link "${l['titulo']}" (quem tiver o endereço não conseguirá mais usar)`,
      acoes: [
        {
          icone: 'content_copy',
          rotulo: 'Copiar endereço',
          executar: (l) =>
            of(linkPublico(l['token'])).pipe(
              switchMap((endereco) => copiar(endereco).then((ok) => ctx.notificacao.sucesso(ok ? `Link copiado: ${endereco}` : endereco))),
              map(() => undefined),
            ),
        },
      ],
    },
  ],
});

export const jornadas: FabricaDeTela = (ctx) => ({
  abas: [
    {
      aba: 'Jornadas',
      titulo: 'Jornadas de relacionamento',
      subtitulo: 'Sequências de contatos depois de um evento (boas-vindas, pós-venda). Cada etapa avisa o responsável no dia certo.',
      rotuloNovo: 'Nova jornada',
      rotuloBusca: 'Buscar pelo nome',
      tabela: 'jornadas_relacionamento',
      ordem: [{ coluna: 'nome' }],
      busca: ['nome'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'nome', rotulo: 'Jornada', valor: (j) => j['nome'], detalhe: (j) => j['descricao'] },
        { chave: 'gatilho', rotulo: 'Começa quando', valor: (j) => rotulo(GATILHOS, j['gatilho']) },
      ],
      campos: [
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 100, meia: true },
        { chave: 'gatilho', rotulo: 'Começa quando', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(GATILHOS) },
        { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea', max: 500 },
        { chave: 'ativo', rotulo: 'Ativa', tipo: 'toggle' },
      ],
      valoresPadrao: { gatilho: 'MANUAL', ativo: true },
      descrever: (j) => `A jornada "${j['nome']}"`,
      acoes: [
        {
          icone: 'format_list_numbered',
          rotulo: 'Etapas',
          sucesso: 'Etapas salvas.',
          executar: (j) =>
            editarLinhas(ctx.dialog, {
              titulo: `Etapas · ${j['nome']}`,
              subtitulo: 'Dias contados a partir da entrada do cliente na jornada.',
              tabela: 'jornada_etapas',
              chaveDoPai: 'jornada_id',
              paiId: j['id'],
              colunaDeOrdem: 'ordem',
              colunas: [
                { chave: 'nome', rotulo: 'Etapa', obrigatorio: true, peso: 2 },
                { chave: 'diasApos', rotulo: 'Dias após', tipo: 'numero', obrigatorio: true },
                { chave: 'acao', rotulo: 'Ação', tipo: 'select', obrigatorio: true, opcoes: opcoes(ACOES_DE_ETAPA) },
                { chave: 'instrucoes', rotulo: 'Instruções', peso: 2 },
              ],
              novaLinha: () => ({ diasApos: 0, acao: 'TAREFA' }),
            }),
        },
        {
          icone: 'person_add',
          rotulo: 'Inscrever cliente',
          executar: (j) =>
            ctx.opcoes
              .resolver([{ chave: 'clienteId', rotulo: 'Cliente', tipo: 'select', obrigatorio: true, fonte: { tabela: 'clientes', filtro: { ativo: true } } }])
              .pipe(
                switchMap((campos) =>
                  ctx.dialogos.formulario(
                    {
                      titulo: `Inscrever em ${j['nome']}`,
                      campos,
                      textoSalvar: 'Inscrever',
                      salvar: (d) =>
                        ctx.supabase
                          .executar<Registro[]>(() =>
                            ctx.supabase.cliente
                              .from('jornada_etapas')
                              .select('id, dias_apos')
                              .eq('jornada_id', j['id'])
                              .order('ordem')
                              .order('dias_apos')
                              .limit(1),
                          )
                          .pipe(
                            switchMap(([primeira]) =>
                              ctx.supabase.executar(() =>
                                ctx.supabase.cliente
                                  .from('jornada_participantes')
                                  .insert({
                                    jornada_id: j['id'],
                                    cliente_id: d['clienteId'],
                                    etapa_atual_id: primeira?.['id'] ?? null,
                                    proxima_acao_em: primeira ? new Date(Date.now() + primeira['diasApos'] * 86_400_000).toISOString() : null,
                                  })
                                  .select()
                                  .single(),
                              ),
                            ),
                          ),
                    },
                    'Cliente inscrito na jornada.',
                  ),
                ),
              ),
        },
      ],
    },
    {
      aba: 'Participantes',
      titulo: 'Clientes nas jornadas',
      tabela: 'jornada_participantes',
      selecao: '*, jornada:jornadas_relacionamento(nome), cliente:clientes(nome), etapa:jornada_etapas(nome, acao)',
      ordem: [{ coluna: 'status' }, { coluna: 'proxima_acao_em', nulosPorUltimo: true }],
      vazio: 'Nenhum cliente em jornadas.',
      colunas: [
        { chave: 'cliente', rotulo: 'Cliente', valor: (p) => p['cliente']?.['nome'], detalhe: (p) => p['jornada']?.['nome'] },
        { chave: 'etapa', rotulo: 'Etapa atual', valor: (p) => p['etapa']?.['nome'], detalhe: (p) => rotulo(ACOES_DE_ETAPA, p['etapa']?.['acao']) },
        { chave: 'proximaAcaoEm', rotulo: 'Próxima ação', valor: (p) => dataHora(p['proximaAcaoEm']) },
        { chave: 'status', rotulo: 'Situação', valor: (p) => rotulo(STATUS_DO_PARTICIPANTE, p['status']) },
      ],
      descrever: (p) => `A inscrição de ${p['cliente']?.['nome'] ?? 'cliente'}`,
      acoes: [
        {
          icone: 'skip_next',
          rotulo: 'Etapa feita, avançar',
          visivel: (p) => p['status'] === 'ATIVO',
          sucesso: 'Jornada avançada.',
          executar: (p) => ctx.supabase.rpc('avancar_jornada', { p_participante: p['id'] }),
        },
        {
          icone: 'block',
          rotulo: 'Tirar da jornada',
          visivel: (p) => p['status'] === 'ATIVO',
          sucesso: 'Cliente retirado da jornada.',
          executar: (p) =>
            ctx.supabase.executar(() => ctx.supabase.cliente.from('jornada_participantes').update({ status: 'CANCELADO' }).eq('id', p['id'])),
        },
      ],
    },
  ],
});
