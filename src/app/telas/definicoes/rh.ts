import { from, map, switchMap } from 'rxjs';
import { copiar, data, opcoes, rotulo } from '../formatos';
import { FabricaDeTela, Registro } from '../tela.model';

const STATUS_DA_VAGA: Record<string, string> = { RASCUNHO: 'Rascunho', ABERTA: 'Aberta', PAUSADA: 'Pausada', ENCERRADA: 'Encerrada' };
const MODALIDADES: Record<string, string> = { PRESENCIAL: 'Presencial', REMOTO: 'Remoto', HIBRIDO: 'Híbrido' };
const CONTRATOS: Record<string, string> = { CLT: 'CLT', PJ: 'PJ', ESTAGIO: 'Estágio', TEMPORARIO: 'Temporário', FREELANCER: 'Freelancer' };
const ETAPAS: Record<string, string> = {
  TRIAGEM: 'Triagem',
  ENTREVISTA: 'Entrevista',
  TESTE: 'Teste',
  PROPOSTA: 'Proposta',
  CONTRATADO: 'Contratado',
  REPROVADO: 'Reprovado',
  DESISTIU: 'Desistiu',
};
const ORIGENS: Record<string, string> = { SITE: 'Site', INDICACAO: 'Indicação', LINKEDIN: 'LinkedIn', OUTRO: 'Outro' };

export const vagas: FabricaDeTela = (ctx) => ({
  abas: [
    {
      titulo: 'Vagas',
      subtitulo: 'Vagas abertas e públicas aparecem na página "Trabalhe conosco", sem login.',
      rotuloNovo: 'Nova vaga',
      rotuloBusca: 'Buscar por título, número ou departamento',
      tabela: 'vagas_emprego',
      busca: ['titulo', 'numero', 'departamento'],
      colunas: [
        { chave: 'titulo', rotulo: 'Vaga', valor: (v) => `${v['numero'] ?? ''} ${v['titulo']}`.trim(), detalhe: (v) => v['departamento'] },
        { chave: 'status', rotulo: 'Situação', valor: (v) => rotulo(STATUS_DA_VAGA, v['status']), detalhe: (v) => (v['publica'] ? 'Pública' : 'Interna') },
        { chave: 'modalidade', rotulo: 'Modalidade', valor: (v) => rotulo(MODALIDADES, v['modalidade']), detalhe: (v) => rotulo(CONTRATOS, v['tipoContrato']) },
        { chave: 'responsavel', rotulo: 'Responsável', valor: (v) => ctx.nomeDoUsuario(v['responsavelId']) },
      ],
      campos: [
        { chave: 'titulo', rotulo: 'Título', obrigatorio: true, max: 120, meia: true },
        { chave: 'departamento', rotulo: 'Departamento', max: 80, meia: true },
        { chave: 'status', rotulo: 'Situação', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(STATUS_DA_VAGA) },
        { chave: 'modalidade', rotulo: 'Modalidade', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(MODALIDADES) },
        { chave: 'tipoContrato', rotulo: 'Contrato', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(CONTRATOS) },
        { chave: 'local', rotulo: 'Local', max: 100, meia: true },
        { chave: 'faixaSalarial', rotulo: 'Faixa salarial', max: 60, meia: true },
        { chave: 'responsavelId', rotulo: 'Responsável', tipo: 'select', meia: true, fonte: { usuarios: true } },
        { chave: 'abertura', rotulo: 'Abertura', tipo: 'data', meia: true },
        { chave: 'encerramento', rotulo: 'Encerramento', tipo: 'data', meia: true },
        { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea', max: 8000 },
        { chave: 'requisitos', rotulo: 'Requisitos', tipo: 'textarea', max: 8000 },
        { chave: 'publica', rotulo: 'Publicar em "Trabalhe conosco"', tipo: 'toggle' },
      ],
      valoresPadrao: { status: 'RASCUNHO', modalidade: 'PRESENCIAL', tipoContrato: 'CLT', publica: false, responsavelId: ctx.auth.usuario()?.id },
      descrever: (v) => `A vaga "${v['titulo']}"`,
      acoes: [
        {
          icone: 'content_copy',
          rotulo: 'Copiar link da vaga',
          visivel: (v) => v['publica'] && v['status'] === 'ABERTA',
          executar: (v) => {
            const endereco = `${location.origin}/trabalhe-conosco?vaga=${v['id']}`;
            return from(copiar(endereco)).pipe(map((ok) => ctx.notificacao.sucesso(ok ? `Link copiado: ${endereco}` : endereco)));
          },
        },
      ],
    },
  ],
});

export const candidatos: FabricaDeTela = (ctx) => ({
  abas: [
    {
      aba: 'Candidaturas',
      titulo: 'Candidaturas',
      subtitulo: 'Cada pessoa em cada vaga, com a etapa do processo seletivo.',
      rotuloNovo: 'Nova candidatura',
      tabela: 'candidaturas_vaga',
      selecao: '*, pessoa:pessoas_candidatas(nome, email, telefone, curriculo_caminho), vaga:vagas_emprego(titulo)',
      colunas: [
        { chave: 'pessoa', rotulo: 'Pessoa', valor: (c) => c['pessoa']?.['nome'], detalhe: (c) => c['pessoa']?.['email'] },
        { chave: 'vaga', rotulo: 'Vaga', valor: (c) => c['vaga']?.['titulo'] },
        { chave: 'etapa', rotulo: 'Etapa', valor: (c) => rotulo(ETAPAS, c['etapa']) },
        { chave: 'avaliacao', rotulo: 'Avaliação', valor: (c) => (c['avaliacao'] ? '★'.repeat(c['avaliacao']) : null) },
        { chave: 'criadoEm', rotulo: 'Recebida em', valor: (c) => data(c['criadoEm']) },
      ],
      campos: [
        { chave: 'vagaId', rotulo: 'Vaga', tipo: 'select', obrigatorio: true, meia: true, fonte: { tabela: 'vagas_emprego', rotulo: 'titulo' } },
        { chave: 'pessoaId', rotulo: 'Pessoa', tipo: 'select', obrigatorio: true, meia: true, fonte: { tabela: 'pessoas_candidatas', detalhe: 'email' } },
        { chave: 'etapa', rotulo: 'Etapa', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(ETAPAS) },
        { chave: 'avaliacao', rotulo: 'Avaliação (1 a 5)', tipo: 'numero', min: 1, max: 5, meia: true },
        { chave: 'observacoes', rotulo: 'Observações', tipo: 'textarea', max: 4000 },
      ],
      valoresPadrao: { etapa: 'TRIAGEM' },
      descrever: (c) => `A candidatura de ${c['pessoa']?.['nome'] ?? ''}`,
      acoes: [
        {
          icone: 'description',
          rotulo: 'Abrir currículo',
          visivel: (c) => !!c['pessoa']?.['curriculoCaminho'],
          executar: (c) =>
            ctx.supabase
              .executar<Registro>(() => ctx.supabase.cliente.storage.from('arquivos').createSignedUrl(c['pessoa']['curriculoCaminho'], 60))
              .pipe(
                switchMap(async (url) => {
                  window.open(url['signedUrl'], '_blank', 'noopener');
                }),
              ),
        },
      ],
    },
    {
      aba: 'Pessoas',
      titulo: 'Banco de talentos',
      rotuloNovo: 'Nova pessoa',
      rotuloBusca: 'Buscar por nome, e-mail ou cidade',
      tabela: 'pessoas_candidatas',
      busca: ['nome', 'email', 'cidade'],
      entidade: 'pessoas_candidatas',
      colunas: [
        { chave: 'nome', rotulo: 'Pessoa', valor: (p) => p['nome'], detalhe: (p) => p['email'] },
        { chave: 'telefone', rotulo: 'Telefone', valor: (p) => p['telefone'] },
        { chave: 'cidade', rotulo: 'Cidade', valor: (p) => p['cidade'] },
        { chave: 'origem', rotulo: 'Origem', valor: (p) => rotulo(ORIGENS, p['origem']) },
      ],
      campos: [
        { chave: 'nome', rotulo: 'Nome', obrigatorio: true, max: 150, meia: true },
        { chave: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, max: 254, meia: true },
        { chave: 'telefone', rotulo: 'Telefone', max: 30, meia: true },
        { chave: 'cidade', rotulo: 'Cidade', max: 80, meia: true },
        { chave: 'linkedinUrl', rotulo: 'LinkedIn', max: 300, meia: true },
        { chave: 'portfolioUrl', rotulo: 'Portfólio', max: 300, meia: true },
        { chave: 'origem', rotulo: 'Origem', tipo: 'select', obrigatorio: true, meia: true, opcoes: opcoes(ORIGENS) },
        { chave: 'resumo', rotulo: 'Resumo', tipo: 'textarea', max: 4000 },
      ],
      valoresPadrao: { origem: 'INDICACAO' },
      descrever: (p) => `${p['nome']} e as candidaturas dela`,
    },
  ],
});
