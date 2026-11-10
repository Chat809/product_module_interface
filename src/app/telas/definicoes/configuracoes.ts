import { forkJoin, map, of, switchMap } from 'rxjs';
import { MODULOS } from '../../core/auth/acessos';
import { ENTIDADES_COM_EXTRAS, TIPOS_DE_CAMPO_EXTRA } from '../../shared/campos-extras/campos-extras.service';
import { opcoes, rotulo } from '../formatos';
import { FabricaDeTela, Registro } from '../tela.model';

const ROTULO_DA_ENTIDADE = Object.fromEntries(ENTIDADES_COM_EXTRAS.map((e) => [e.valor, e.rotulo]));
const CANAIS: Record<string, string> = { EMAIL: 'E-mail', WHATSAPP: 'WhatsApp', SMS: 'SMS' };

/** Subabas que um grupo pode liberar; as exclusivas do administrador ficam de fora. */
const OPCOES_DE_ACESSO = MODULOS.flatMap((m) =>
  m.subabas.filter((s) => !s.somenteAdmin && !s.livre).map((s) => ({ valor: s.chave, rotulo: `${m.rotulo} › ${s.rotulo}` })),
);

export const camposExtras: FabricaDeTela = () => ({
  abas: [
    {
      titulo: 'Campos extras',
      subtitulo: 'Campos próprios desta empresa nos cadastros, sem mudar o banco. Aparecem no fim dos formulários.',
      rotuloNovo: 'Novo campo',
      rotuloBusca: 'Buscar por rótulo ou chave',
      vazio: 'Nenhum campo extra criado.',
      tabela: 'campos_extras',
      ordem: [{ coluna: 'entidade' }, { coluna: 'ordem' }, { coluna: 'rotulo' }],
      busca: ['rotulo', 'chave'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'rotulo', rotulo: 'Campo', valor: (c) => c['rotulo'], detalhe: (c) => c['chave'] },
        { chave: 'entidade', rotulo: 'Cadastro', valor: (c) => rotulo(ROTULO_DA_ENTIDADE, c['entidade']) },
        { chave: 'tipo', rotulo: 'Tipo', valor: (c) => rotulo(TIPOS_DE_CAMPO_EXTRA, c['tipo']) },
        { chave: 'obrigatorio', rotulo: 'Obrigatório', valor: (c) => (c['obrigatorio'] ? 'Sim' : 'Não') },
      ],
      campos: [
        { chave: 'entidade', rotulo: 'Cadastro', tipo: 'select', obrigatorio: true, meia: true, opcoes: ENTIDADES_COM_EXTRAS },
        { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(TIPOS_DE_CAMPO_EXTRA) },
        { chave: 'rotulo', rotulo: 'Rótulo', obrigatorio: true, max: 80, meia: true },
        {
          chave: 'chave',
          rotulo: 'Chave',
          obrigatorio: true,
          max: 40,
          meia: true,
          padrao: /^\s*[a-z][a-z0-9_]*\s*$/,
          mensagemPadrao: 'Letras minúsculas, números e _, começando por letra',
          dica: 'Nome técnico, ex.: tamanho_camiseta',
        },
        { chave: 'opcoes', rotulo: 'Opções (uma por linha)', tipo: 'textarea', max: 4000, dica: 'Só para os tipos lista' },
        { chave: 'ordem', rotulo: 'Ordem', tipo: 'numero', min: 0, meia: true },
        { chave: 'obrigatorio', rotulo: 'Obrigatório', tipo: 'toggle' },
        { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle' },
      ],
      valoresPadrao: { tipo: 'texto', ordem: 0, obrigatorio: false, ativo: true },
      paraFormulario: (c) => ({
        ...c,
        opcoes: ((c['opcoes'] ?? []) as (string | { rotulo: string })[]).map((o) => (typeof o === 'string' ? o : o.rotulo)).join('\n'),
      }),
      antesDeSalvar: (dados) => ({
        ...dados,
        opcoes: String(dados['opcoes'] ?? '')
          .split('\n')
          .map((o) => o.trim())
          .filter(Boolean),
        ordem: dados['ordem'] ?? 0,
      }),
      descrever: (c) => `O campo "${c['rotulo']}" (os valores já gravados continuam nos registros)`,
    },
  ],
});

export const listas: FabricaDeTela = () => ({
  abas: [
    {
      titulo: 'Listas auxiliares',
      subtitulo: 'Opções usadas nos formulários (formas de pagamento, unidades, motivos de perda...).',
      rotuloNovo: 'Novo item',
      rotuloBusca: 'Buscar por lista, valor ou rótulo',
      tabela: 'listas_auxiliares',
      ordem: [{ coluna: 'lista' }, { coluna: 'ordem' }, { coluna: 'rotulo' }],
      busca: ['lista', 'valor', 'rotulo'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'lista', rotulo: 'Lista', valor: (l) => l['lista'] },
        { chave: 'rotulo', rotulo: 'Rótulo', valor: (l) => l['rotulo'], detalhe: (l) => l['valor'] },
        { chave: 'ordem', rotulo: 'Ordem', valor: (l) => l['ordem'] },
      ],
      campos: [
        { chave: 'lista', rotulo: 'Lista', obrigatorio: true, max: 60, meia: true, padrao: /^\s*[a-z][a-z0-9_]*\s*$/, mensagemPadrao: 'Use letras minúsculas, números e _' },
        { chave: 'valor', rotulo: 'Valor gravado', obrigatorio: true, max: 60, meia: true },
        { chave: 'rotulo', rotulo: 'Rótulo exibido', obrigatorio: true, max: 80, meia: true },
        { chave: 'cor', rotulo: 'Cor', tipo: 'cor', meia: true },
        { chave: 'ordem', rotulo: 'Ordem', tipo: 'numero', min: 0, meia: true },
        { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle' },
      ],
      valoresPadrao: { ordem: 0, ativo: true },
      antesDeSalvar: (dados) => ({ ...dados, ordem: dados['ordem'] ?? 0 }),
      descrever: (l) => `O item "${l['rotulo']}" da lista ${l['lista']}`,
    },
  ],
});

function exemploDeNumero(s: Registro): string {
  const ano = s['incluirAno'] ? `${s['anoCorrente']}-` : '';
  return `${s['prefixo'] ?? ''}${ano}${String(s['proximo']).padStart(Number(s['digitos']), '0')}`;
}

export const numeracao: FabricaDeTela = () => ({
  abas: [
    {
      titulo: 'Numeração de documentos',
      subtitulo: 'Formato dos números de propostas, pedidos e vagas. O próximo número é reservado ao gravar o documento.',
      tabela: 'sequencias_documento',
      chave: 'chave',
      ordem: [{ coluna: 'chave' }],
      busca: ['chave', 'descricao'],
      podeCriar: false,
      podeExcluir: false,
      colunas: [
        { chave: 'descricao', rotulo: 'Documento', valor: (s) => s['descricao'], detalhe: (s) => s['chave'] },
        { chave: 'proximo', rotulo: 'Próximo número', valor: exemploDeNumero },
        { chave: 'reinicia', rotulo: 'Reinicia a cada ano', valor: (s) => (s['reiniciaAnual'] ? 'Sim' : 'Não') },
      ],
      campos: [
        { chave: 'descricao', rotulo: 'Descrição', obrigatorio: true, max: 80 },
        { chave: 'prefixo', rotulo: 'Prefixo', max: 10, meia: true, dica: 'Ex.: PROP-' },
        { chave: 'digitos', rotulo: 'Dígitos', tipo: 'numero', obrigatorio: true, min: 1, max: 12, meia: true },
        { chave: 'proximo', rotulo: 'Próximo número', tipo: 'numero', obrigatorio: true, min: 1, meia: true },
        { chave: 'incluirAno', rotulo: 'Incluir o ano no número', tipo: 'toggle' },
        { chave: 'reiniciaAnual', rotulo: 'Voltar para 1 a cada ano', tipo: 'toggle' },
      ],
      antesDeSalvar: (dados) => ({ ...dados, prefixo: dados['prefixo'] ?? '' }),
    },
  ],
});

export const grupos: FabricaDeTela = () => ({
  abas: [
    {
      titulo: 'Grupos de permissão',
      subtitulo: 'Conjuntos de acessos para dar a várias pessoas de uma vez. Valem junto com os acessos de cada usuário.',
      rotuloNovo: 'Novo grupo',
      rotuloBusca: 'Buscar por nome',
      tabela: 'grupos_permissao',
      selecao: '*, membros:grupos_permissao_membros(usuario_id)',
      ordem: [{ coluna: 'nome' }],
      busca: ['nome', 'descricao'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'nome', rotulo: 'Grupo', valor: (g) => g['nome'], detalhe: (g) => g['descricao'] },
        { chave: 'acessos', rotulo: 'Acessos', valor: (g) => `${(g['acessos'] ?? []).length} liberado(s)` },
        { chave: 'membros', rotulo: 'Membros', valor: (g) => (g['membros'] ?? []).length },
      ],
      campos: [
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80 },
        { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea', max: 300 },
        { chave: 'acessos', rotulo: 'Acessos liberados', tipo: 'multipla', opcoes: OPCOES_DE_ACESSO },
        { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle' },
      ],
      valoresPadrao: { ativo: true, acessos: [] },
      descrever: (g) => `O grupo "${g['nome']}"`,
      acoes: [
        {
          icone: 'group',
          rotulo: 'Membros',
          sucesso: 'Membros atualizados.',
          executar: (grupo, ctx) => {
            const atuais: string[] = (grupo['membros'] ?? []).map((m: Registro) => m['usuarioId']);
            return ctx.opcoes.resolver([{ chave: 'usuarios', rotulo: 'Pessoas no grupo', tipo: 'multipla', fonte: { usuarios: true } }]).pipe(
              switchMap((campos) =>
                ctx.dialogos.formulario(
                  {
                    titulo: `Membros de ${grupo['nome']}`,
                    campos,
                    valores: { usuarios: atuais },
                    salvar: (dados) => {
                      const escolhidos = (dados['usuarios'] ?? []) as string[];
                      const sair = atuais.filter((id) => !escolhidos.includes(id));
                      const entrar = escolhidos.filter((id) => !atuais.includes(id));
                      const tabela = () => ctx.supabase.cliente.from('grupos_permissao_membros');
                      return forkJoin([
                        sair.length
                          ? ctx.supabase.executar(() => tabela().delete().eq('grupo_id', grupo['id']).in('usuario_id', sair))
                          : of(null),
                        entrar.length
                          ? ctx.supabase.executar(() => tabela().insert(entrar.map((usuario_id) => ({ grupo_id: grupo['id'], usuario_id }))))
                          : of(null),
                      ]).pipe(map(() => true));
                    },
                  },
                  'Membros salvos.',
                ),
              ),
            );
          },
        },
      ],
    },
  ],
});

export const modelosComunicacao: FabricaDeTela = () => ({
  abas: [
    {
      titulo: 'Modelos de comunicação',
      subtitulo: 'Textos prontos para e-mail e WhatsApp. Use {{nome}}, {{empresa}} e outros campos do registro.',
      rotuloNovo: 'Novo modelo',
      rotuloBusca: 'Buscar por nome ou assunto',
      tabela: 'modelos_comunicacao',
      ordem: [{ coluna: 'nome' }],
      busca: ['nome', 'assunto'],
      filtrarAtivos: true,
      colunas: [
        { chave: 'nome', rotulo: 'Modelo', valor: (m) => m['nome'], detalhe: (m) => m['assunto'] },
        { chave: 'canal', rotulo: 'Canal', valor: (m) => rotulo(CANAIS, m['canal']) },
        { chave: 'entidade', rotulo: 'Usado em', valor: (m) => rotulo(ROTULO_DA_ENTIDADE, m['entidade']) ?? 'Qualquer cadastro' },
      ],
      campos: [
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80, meia: true },
        { chave: 'canal', rotulo: 'Canal', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(CANAIS) },
        { chave: 'entidade', rotulo: 'Usado em', tipo: 'select', meia: true, opcoes: ENTIDADES_COM_EXTRAS },
        { chave: 'assunto', rotulo: 'Assunto (e-mail)', max: 150, meia: true },
        { chave: 'corpo', rotulo: 'Texto', tipo: 'textarea', obrigatorio: true, max: 10000 },
        { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle' },
      ],
      valoresPadrao: { canal: 'EMAIL', ativo: true },
      descrever: (m) => `O modelo "${m['nome']}"`,
    },
  ],
});
