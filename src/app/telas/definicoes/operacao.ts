import { switchMap } from 'rxjs';
import { editarLinhas } from '../editor-linhas';
import { opcoes } from '../formatos';
import { FabricaDeTela } from '../tela.model';

const STATUS_DE_DEMANDA: Record<string, string> = {
  A_FAZER: 'A fazer',
  EM_ANDAMENTO: 'Em andamento',
  EM_REVISAO: 'Em revisão',
  CONCLUIDO: 'Concluído',
};

export const roteiros: FabricaDeTela = (ctx) => ({
  abas: [
    {
      titulo: 'Roteiros de checklist',
      subtitulo: 'Listas de passos prontas (onboarding, entrega, fechamento do mês) para aplicar nas demandas.',
      rotuloNovo: 'Novo roteiro',
      rotuloBusca: 'Buscar pelo nome ou categoria',
      tabela: 'roteiros_checklist',
      ordem: [{ coluna: 'nome' }],
      busca: ['nome', 'categoria'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'nome', rotulo: 'Roteiro', valor: (r) => r['nome'], detalhe: (r) => r['categoria'] },
        { chave: 'itens', rotulo: 'Passos', valor: (r) => (r['itens'] ?? []).length },
      ],
      campos: [
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 100, meia: true },
        { chave: 'categoria', rotulo: 'Categoria', max: 60, meia: true },
        { chave: 'descricao', rotulo: 'Descrição', max: 300 },
        { chave: 'itens', rotulo: 'Passos (um por linha)', tipo: 'textarea', obrigatorio: true, max: 10000 },
        { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle' },
      ],
      valoresPadrao: { ativo: true },
      paraFormulario: (r) => ({ ...r, itens: ((r['itens'] ?? []) as { texto: string }[]).map((i) => i.texto).join('\n') }),
      antesDeSalvar: (d) => ({
        ...d,
        itens: String(d['itens'] ?? '')
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean)
          .map((texto) => ({ texto: texto.slice(0, 200) })),
      }),
      descrever: (r) => `O roteiro "${r['nome']}"`,
      acoes: [
        {
          icone: 'playlist_add_check',
          rotulo: 'Aplicar a uma demanda',
          executar: (r) =>
            ctx.opcoes
              .resolver([{ chave: 'demandaId', rotulo: 'Demanda', tipo: 'select', obrigatorio: true, fonte: { tabela: 'demandas', rotulo: 'titulo' } }])
              .pipe(
                switchMap((campos) =>
                  ctx.dialogos.formulario(
                    {
                      titulo: `Aplicar "${r['nome']}"`,
                      campos,
                      textoSalvar: 'Aplicar',
                      salvar: (d) => ctx.supabase.rpc('aplicar_roteiro', { p_roteiro: r['id'], p_demanda: d['demandaId'] }),
                    },
                    'Passos adicionados ao checklist da demanda.',
                  ),
                ),
              ),
        },
      ],
    },
  ],
});

export const quadros: FabricaDeTela = (ctx) => ({
  abas: [
    {
      tipo: 'componente',
      aba: 'Quadro',
      componente: () => import('../componentes/quadros-kanban').then((m) => m.QuadrosKanban),
    },
    {
      aba: 'Configurar quadros',
      titulo: 'Quadros',
      subtitulo: 'Quadros com colunas próprias por equipe. Cada coluna corresponde a um status da demanda.',
      rotuloNovo: 'Novo quadro',
      rotuloBusca: 'Buscar pelo nome',
      tabela: 'quadros_kanban',
      ordem: [{ coluna: 'nome' }],
      busca: ['nome'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'nome', rotulo: 'Quadro', valor: (q) => q['nome'], detalhe: (q) => q['descricao'] },
        { chave: 'padrao', rotulo: 'Padrão', valor: (q) => (q['padrao'] ? 'Sim' : 'Não') },
      ],
      campos: [
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80, meia: true },
        { chave: 'cor', rotulo: 'Cor', tipo: 'cor', meia: true },
        { chave: 'descricao', rotulo: 'Descrição', max: 300 },
        { chave: 'padrao', rotulo: 'Quadro padrão (recebe as demandas novas)', tipo: 'toggle' },
        { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle' },
      ],
      valoresPadrao: { padrao: false, ativo: true, cor: '#1e88e5' },
      descrever: (q) => `O quadro "${q['nome']}"`,
      acoes: [
        {
          icone: 'view_column',
          rotulo: 'Colunas',
          sucesso: 'Colunas salvas.',
          executar: (q) =>
            editarLinhas(ctx.dialog, {
              titulo: `Colunas · ${q['nome']}`,
              subtitulo: 'Limite WIP: máximo de demandas na coluna (vazio = sem limite).',
              tabela: 'quadro_kanban_colunas',
              chaveDoPai: 'quadro_id',
              paiId: q['id'],
              colunaDeOrdem: 'ordem',
              colunas: [
                { chave: 'nome', rotulo: 'Coluna', obrigatorio: true, peso: 2 },
                { chave: 'statusEquivalente', rotulo: 'Status', tipo: 'select', obrigatorio: true, peso: 2, opcoes: opcoes(STATUS_DE_DEMANDA) },
                { chave: 'cor', rotulo: 'Cor', tipo: 'cor' },
                { chave: 'limiteWip', rotulo: 'Limite WIP', tipo: 'numero' },
              ],
              novaLinha: () => ({ statusEquivalente: 'A_FAZER', cor: '#90a4ae' }),
            }),
        },
      ],
    },
  ],
});
