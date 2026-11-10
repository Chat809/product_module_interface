-- relatorios
-- Relatórios: todas as funções devolvem {indicadores:[{rotulo,valor,formato}], graficos:[{titulo,formato,itens:[{rotulo,valor}]}],
-- tabelas:[{titulo,colunas:[{chave,rotulo,formato}],linhas:[...]}]}. formato: moeda | numero | percentual | dias | texto.

create or replace function public.relatorio_financeiro(p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_recebido numeric;
  v_pago numeric;
  v_a_receber numeric;
  v_a_pagar numeric;
  v_vencido_receber numeric;
  v_vencido_pagar numeric;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Informe um período válido: a data final deve ser igual ou posterior à inicial';
  end if;
  if p_fim - p_inicio > 1096 then
    raise exception 'O período pode ter no máximo 3 anos';
  end if;

  select coalesce(sum(valor_liquido), 0) into v_recebido from public.contas_receber
   where status = 'RECEBIDO' and data_recebimento between p_inicio and p_fim;
  select coalesce(sum(valor_liquido), 0) into v_pago from public.contas_pagar
   where status = 'PAGO' and data_pagamento between p_inicio and p_fim;
  select coalesce(sum(valor_liquido), 0) into v_a_receber from public.contas_receber
   where status = 'PENDENTE' and vencimento between p_inicio and p_fim;
  select coalesce(sum(valor_liquido), 0) into v_a_pagar from public.contas_pagar
   where status = 'PENDENTE' and vencimento between p_inicio and p_fim;
  select coalesce(sum(valor_liquido), 0) into v_vencido_receber from public.contas_receber
   where status = 'PENDENTE' and vencimento < current_date;
  select coalesce(sum(valor_liquido), 0) into v_vencido_pagar from public.contas_pagar
   where status = 'PENDENTE' and vencimento < current_date;

  return jsonb_build_object(
    'indicadores', jsonb_build_array(
      jsonb_build_object('rotulo', 'Recebido', 'valor', v_recebido, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Pago', 'valor', v_pago, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Saldo do período', 'valor', v_recebido - v_pago, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'A receber no período', 'valor', v_a_receber, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'A pagar no período', 'valor', v_a_pagar, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Vencido a receber (hoje)', 'valor', v_vencido_receber, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Vencido a pagar (hoje)', 'valor', v_vencido_pagar, 'formato', 'moeda')
    ),
    'graficos', jsonb_build_array(
      jsonb_build_object('titulo', 'Despesas pagas por categoria', 'formato', 'moeda', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by valor desc), '[]'::jsonb)
           from (select coalesce(nullif(btrim(categoria), ''), 'Sem categoria') as rotulo, sum(valor_liquido) as valor
                   from public.contas_pagar
                  where status = 'PAGO' and data_pagamento between p_inicio and p_fim
                  group by 1) x)),
      jsonb_build_object('titulo', 'Receitas recebidas por categoria', 'formato', 'moeda', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by valor desc), '[]'::jsonb)
           from (select coalesce(nullif(btrim(categoria), ''), 'Sem categoria') as rotulo, sum(valor_liquido) as valor
                   from public.contas_receber
                  where status = 'RECEBIDO' and data_recebimento between p_inicio and p_fim
                  group by 1) x)),
      jsonb_build_object('titulo', 'Despesas pagas por centro de custo', 'formato', 'moeda', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by valor desc), '[]'::jsonb)
           from (select coalesce(cc.nome, 'Sem centro de custo') as rotulo, sum(c.valor_liquido) as valor
                   from public.contas_pagar c
                   left join public.centros_custo cc on cc.id = c.centro_custo_id
                  where c.status = 'PAGO' and c.data_pagamento between p_inicio and p_fim
                  group by 1) x))
    ),
    'tabelas', jsonb_build_array(
      jsonb_build_object(
        'titulo', 'Fluxo mensal',
        'colunas', jsonb_build_array(
          jsonb_build_object('chave', 'mes', 'rotulo', 'Mês', 'formato', 'texto'),
          jsonb_build_object('chave', 'recebido', 'rotulo', 'Recebido', 'formato', 'moeda'),
          jsonb_build_object('chave', 'pago', 'rotulo', 'Pago', 'formato', 'moeda'),
          jsonb_build_object('chave', 'saldo', 'rotulo', 'Saldo', 'formato', 'moeda')),
        'linhas',
        (select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(m, 'MM/YYYY'), 'recebido', r, 'pago', p, 'saldo', r - p)
                                   order by m), '[]'::jsonb)
           from (select g.m,
                        coalesce((select sum(valor_liquido) from public.contas_receber
                                   where status = 'RECEBIDO'
                                     and data_recebimento between greatest(g.m, p_inicio)
                                                              and least((g.m + interval '1 month')::date - 1, p_fim)), 0) as r,
                        coalesce((select sum(valor_liquido) from public.contas_pagar
                                   where status = 'PAGO'
                                     and data_pagamento between greatest(g.m, p_inicio)
                                                            and least((g.m + interval '1 month')::date - 1, p_fim)), 0) as p
                   from (select s::date as m
                           from generate_series(date_trunc('month', p_inicio::timestamp), p_fim::timestamp,
                                                interval '1 month') s) g) x)),
      jsonb_build_object(
        'titulo', 'Maiores favorecidos (pagos no período)',
        'colunas', jsonb_build_array(
          jsonb_build_object('chave', 'favorecido', 'rotulo', 'Favorecido', 'formato', 'texto'),
          jsonb_build_object('chave', 'contas', 'rotulo', 'Contas', 'formato', 'numero'),
          jsonb_build_object('chave', 'total', 'rotulo', 'Total pago', 'formato', 'moeda')),
        'linhas',
        (select coalesce(jsonb_agg(jsonb_build_object('favorecido', favorecido, 'contas', contas, 'total', total)
                                   order by total desc), '[]'::jsonb)
           from (select coalesce(f.nome_fantasia, f.razao_social, nullif(btrim(c.favorecido), ''), 'Não informado') as favorecido,
                        count(*) as contas, sum(c.valor_liquido) as total
                   from public.contas_pagar c
                   left join public.fornecedores f on f.id = c.fornecedor_id
                  where c.status = 'PAGO' and c.data_pagamento between p_inicio and p_fim
                  group by 1
                  order by total desc
                  limit 20) x))
    )
  );
end;
$$;

create or replace function public.relatorio_comercial(p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_criados integer;
  v_convertidos integer;
  v_valor_convertido numeric;
  v_perdidos integer;
  v_novos_clientes integer;
  v_em_negociacao numeric;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Informe um período válido: a data final deve ser igual ou posterior à inicial';
  end if;
  if p_fim - p_inicio > 1096 then
    raise exception 'O período pode ter no máximo 3 anos';
  end if;

  select count(*) into v_criados from public.leads
   where (criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;
  select count(*), coalesce(sum(valor_estimado), 0) into v_convertidos, v_valor_convertido from public.leads
   where (convertido_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;
  select count(*) into v_perdidos from public.leads l join public.crm_etapas e on e.id = l.etapa_id
   where e.tipo = 'PERDIDO' and (l.atualizado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;
  select count(*) into v_novos_clientes from public.clientes
   where (criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;
  select coalesce(sum(l.valor_estimado), 0) into v_em_negociacao from public.leads l
    join public.crm_etapas e on e.id = l.etapa_id
   where e.tipo = 'ABERTA';

  return jsonb_build_object(
    'indicadores', jsonb_build_array(
      jsonb_build_object('rotulo', 'Leads criados', 'valor', v_criados, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Convertidos em cliente', 'valor', v_convertidos, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Taxa de conversão', 'valor',
        case when v_criados > 0 then round(v_convertidos * 100.0 / v_criados, 1) else 0 end, 'formato', 'percentual'),
      jsonb_build_object('rotulo', 'Valor estimado convertido', 'valor', v_valor_convertido, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Leads perdidos', 'valor', v_perdidos, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Novos clientes', 'valor', v_novos_clientes, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Em negociação agora', 'valor', v_em_negociacao, 'formato', 'moeda')
    ),
    'graficos', jsonb_build_array(
      jsonb_build_object('titulo', 'Leads criados por origem', 'formato', 'numero', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by valor desc), '[]'::jsonb)
           from (select coalesce(o.nome, 'Sem origem') as rotulo, count(*) as valor
                   from public.leads l
                   left join public.crm_origens o on o.id = l.origem_id
                  where (l.criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
                  group by 1) x)),
      jsonb_build_object('titulo', 'Funil atual (leads por etapa)', 'formato', 'numero', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', e.nome, 'valor',
                   (select count(*) from public.leads l where l.etapa_id = e.id)) order by e.ordem, e.nome), '[]'::jsonb)
           from public.crm_etapas e
          where e.ativo)),
      jsonb_build_object('titulo', 'Motivos de perda', 'formato', 'numero', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by valor desc), '[]'::jsonb)
           from (select coalesce(nullif(btrim(l.motivo_perda), ''), 'Não informado') as rotulo, count(*) as valor
                   from public.leads l
                   join public.crm_etapas e on e.id = l.etapa_id
                  where e.tipo = 'PERDIDO'
                    and (l.atualizado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
                  group by 1
                  order by valor desc
                  limit 10) x))
    ),
    'tabelas', jsonb_build_array(
      jsonb_build_object(
        'titulo', 'Desempenho por responsável',
        'colunas', jsonb_build_array(
          jsonb_build_object('chave', 'responsavel', 'rotulo', 'Responsável', 'formato', 'texto'),
          jsonb_build_object('chave', 'leads', 'rotulo', 'Leads criados', 'formato', 'numero'),
          jsonb_build_object('chave', 'convertidos', 'rotulo', 'Convertidos', 'formato', 'numero'),
          jsonb_build_object('chave', 'valor', 'rotulo', 'Valor convertido', 'formato', 'moeda')),
        'linhas',
        (select coalesce(jsonb_agg(jsonb_build_object('responsavel', responsavel, 'leads', leads,
                                                      'convertidos', convertidos, 'valor', valor)
                                   order by convertidos desc, leads desc), '[]'::jsonb)
           from (select coalesce(p.nome, 'Sem responsável') as responsavel,
                        count(*) filter (where (l.criado_em at time zone 'America/Sao_Paulo')::date
                                         between p_inicio and p_fim) as leads,
                        count(*) filter (where (l.convertido_em at time zone 'America/Sao_Paulo')::date
                                         between p_inicio and p_fim) as convertidos,
                        coalesce(sum(l.valor_estimado) filter (where (l.convertido_em at time zone 'America/Sao_Paulo')::date
                                                               between p_inicio and p_fim), 0) as valor
                   from public.leads l
                   left join public.perfis p on p.id = l.responsavel_id
                  where (l.criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
                     or (l.convertido_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
                  group by 1) x))
    )
  );
end;
$$;

create or replace function public.relatorio_estoque(p_limite integer default 5)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_ativos integer;
  v_unidades bigint;
  v_valor_custo numeric;
  v_valor_venda numeric;
  v_baixo integer;
  v_sem integer;
begin
  select count(*), coalesce(sum(quantidade_em_estoque), 0),
         coalesce(sum(quantidade_em_estoque * coalesce(custo, 0)), 0),
         coalesce(sum(quantidade_em_estoque * coalesce(preco, 0)), 0),
         count(*) filter (where quantidade_em_estoque > 0 and quantidade_em_estoque <= p_limite),
         count(*) filter (where quantidade_em_estoque <= 0)
    into v_ativos, v_unidades, v_valor_custo, v_valor_venda, v_baixo, v_sem
    from public.produtos
   where ativo;

  return jsonb_build_object(
    'indicadores', jsonb_build_array(
      jsonb_build_object('rotulo', 'Produtos ativos', 'valor', v_ativos, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Unidades em estoque', 'valor', v_unidades, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Valor em estoque (custo)', 'valor', v_valor_custo, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Valor em estoque (venda)', 'valor', v_valor_venda, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Com estoque baixo (até ' || p_limite || ')', 'valor', v_baixo, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Sem estoque', 'valor', v_sem, 'formato', 'numero')
    ),
    'graficos', jsonb_build_array(
      jsonb_build_object('titulo', 'Valor em estoque por categoria (custo)', 'formato', 'moeda', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by valor desc), '[]'::jsonb)
           from (select coalesce(nullif(btrim(categoria), ''), 'Sem categoria') as rotulo,
                        sum(quantidade_em_estoque * coalesce(custo, 0)) as valor
                   from public.produtos
                  where ativo
                  group by 1) x)),
      jsonb_build_object('titulo', 'Mais retirados nos últimos 30 dias (unidades)', 'formato', 'numero', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by valor desc), '[]'::jsonb)
           from (select p.nome as rotulo, sum(m.quantidade) as valor
                   from public.movimentacoes_estoque m
                   join public.produtos p on p.id = m.produto_id
                  where m.tipo = 'SAIDA' and m.criado_em >= now() - interval '30 days'
                  group by p.id, p.nome
                  order by valor desc
                  limit 10) x)),
      jsonb_build_object('titulo', 'Movimentações nos últimos 30 dias', 'formato', 'numero', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by valor desc), '[]'::jsonb)
           from (select case tipo when 'ENTRADA' then 'Entradas' when 'SAIDA' then 'Saídas' else 'Ajustes' end as rotulo,
                        count(*) as valor
                   from public.movimentacoes_estoque
                  where criado_em >= now() - interval '30 days'
                  group by 1) x))
    ),
    'tabelas', jsonb_build_array(
      jsonb_build_object(
        'titulo', 'Produtos com estoque baixo ou zerado',
        'colunas', jsonb_build_array(
          jsonb_build_object('chave', 'codigo', 'rotulo', 'Código', 'formato', 'texto'),
          jsonb_build_object('chave', 'nome', 'rotulo', 'Produto', 'formato', 'texto'),
          jsonb_build_object('chave', 'categoria', 'rotulo', 'Categoria', 'formato', 'texto'),
          jsonb_build_object('chave', 'quantidade', 'rotulo', 'Em estoque', 'formato', 'numero'),
          jsonb_build_object('chave', 'custo', 'rotulo', 'Custo unitário', 'formato', 'moeda')),
        'linhas',
        (select coalesce(jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome, 'categoria', categoria,
                                                      'quantidade', quantidade_em_estoque, 'custo', custo)
                                   order by quantidade_em_estoque, nome), '[]'::jsonb)
           from (select codigo, nome, coalesce(nullif(btrim(categoria), ''), 'Sem categoria') as categoria,
                        quantidade_em_estoque, custo
                   from public.produtos
                  where ativo and quantidade_em_estoque <= p_limite
                  order by quantidade_em_estoque, nome
                  limit 200) x))
    )
  );
end;
$$;

create or replace function public.relatorio_atendimento(p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_abertas integer;
  v_resolvidas integer;
  v_em_aberto integer;
  v_atrasadas integer;
  v_tempo_medio numeric;
  v_no_prazo numeric;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Informe um período válido: a data final deve ser igual ou posterior à inicial';
  end if;
  if p_fim - p_inicio > 1096 then
    raise exception 'O período pode ter no máximo 3 anos';
  end if;

  select count(*) into v_abertas from public.reclamacoes
   where (criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;
  select count(*),
         round(coalesce(avg(extract(epoch from resolvida_em - criado_em) / 86400), 0)::numeric, 1),
         case when count(*) filter (where prazo is not null) > 0
              then round(count(*) filter (where prazo is not null
                                            and (resolvida_em at time zone 'America/Sao_Paulo')::date <= prazo) * 100.0
                         / count(*) filter (where prazo is not null), 1)
              else 0 end
    into v_resolvidas, v_tempo_medio, v_no_prazo
    from public.reclamacoes
   where resolvida_em is not null
     and (resolvida_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;
  select count(*), count(*) filter (where prazo < current_date) into v_em_aberto, v_atrasadas
    from public.reclamacoes
   where status in ('ABERTA', 'EM_ANALISE');

  return jsonb_build_object(
    'indicadores', jsonb_build_array(
      jsonb_build_object('rotulo', 'Abertas no período', 'valor', v_abertas, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Resolvidas no período', 'valor', v_resolvidas, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Tempo médio de resolução', 'valor', v_tempo_medio, 'formato', 'dias'),
      jsonb_build_object('rotulo', 'Resolvidas no prazo', 'valor', v_no_prazo, 'formato', 'percentual'),
      jsonb_build_object('rotulo', 'Em aberto agora', 'valor', v_em_aberto, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Atrasadas agora', 'valor', v_atrasadas, 'formato', 'numero')
    ),
    'graficos', jsonb_build_array(
      jsonb_build_object('titulo', 'Abertas por prioridade', 'formato', 'numero', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by posicao), '[]'::jsonb)
           from (select case prioridade when 'CRITICA' then 'Crítica' when 'ALTA' then 'Alta'
                                        when 'MEDIA' then 'Média' else 'Baixa' end as rotulo,
                        array_position(array['CRITICA', 'ALTA', 'MEDIA', 'BAIXA'], prioridade) as posicao,
                        count(*) as valor
                   from public.reclamacoes
                  where (criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
                  group by 1, 2) x)),
      jsonb_build_object('titulo', 'Abertas por canal', 'formato', 'numero', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by valor desc), '[]'::jsonb)
           from (select case canal when 'TELEFONE' then 'Telefone' when 'EMAIL' then 'E-mail'
                                   when 'WHATSAPP' then 'WhatsApp' when 'PRESENCIAL' then 'Presencial'
                                   when 'SITE' then 'Site' else 'Redes sociais' end as rotulo,
                        count(*) as valor
                   from public.reclamacoes
                  where (criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
                  group by 1) x)),
      jsonb_build_object('titulo', 'Situação atual das abertas no período', 'formato', 'numero', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', rotulo, 'valor', valor) order by posicao), '[]'::jsonb)
           from (select case status when 'ABERTA' then 'Aberta' when 'EM_ANALISE' then 'Em análise'
                                    when 'RESOLVIDA' then 'Resolvida' else 'Encerrada' end as rotulo,
                        array_position(array['ABERTA', 'EM_ANALISE', 'RESOLVIDA', 'ENCERRADA'], status) as posicao,
                        count(*) as valor
                   from public.reclamacoes
                  where (criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
                  group by 1, 2) x))
    ),
    'tabelas', jsonb_build_array(
      jsonb_build_object(
        'titulo', 'Desempenho por responsável',
        'colunas', jsonb_build_array(
          jsonb_build_object('chave', 'responsavel', 'rotulo', 'Responsável', 'formato', 'texto'),
          jsonb_build_object('chave', 'abertas', 'rotulo', 'Abertas no período', 'formato', 'numero'),
          jsonb_build_object('chave', 'resolvidas', 'rotulo', 'Resolvidas no período', 'formato', 'numero'),
          jsonb_build_object('chave', 'tempoMedio', 'rotulo', 'Tempo médio', 'formato', 'dias')),
        'linhas',
        (select coalesce(jsonb_agg(jsonb_build_object('responsavel', responsavel, 'abertas', abertas,
                                                      'resolvidas', resolvidas, 'tempoMedio', tempo_medio)
                                   order by resolvidas desc, abertas desc), '[]'::jsonb)
           from (select coalesce(p.nome, 'Sem responsável') as responsavel,
                        count(*) filter (where (r.criado_em at time zone 'America/Sao_Paulo')::date
                                         between p_inicio and p_fim) as abertas,
                        count(*) filter (where (r.resolvida_em at time zone 'America/Sao_Paulo')::date
                                         between p_inicio and p_fim) as resolvidas,
                        round(coalesce(avg(extract(epoch from r.resolvida_em - r.criado_em) / 86400)
                                       filter (where (r.resolvida_em at time zone 'America/Sao_Paulo')::date
                                               between p_inicio and p_fim), 0)::numeric, 1) as tempo_medio
                   from public.reclamacoes r
                   left join public.perfis p on p.id = r.responsavel_id
                  where (r.criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
                     or (r.resolvida_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
                  group by 1) x))
    )
  );
end;
$$;

revoke all on function public.relatorio_financeiro(date, date) from public, anon, authenticated;
revoke all on function public.relatorio_comercial(date, date) from public, anon, authenticated;
revoke all on function public.relatorio_estoque(integer) from public, anon, authenticated;
revoke all on function public.relatorio_atendimento(date, date) from public, anon, authenticated;
grant execute on function public.relatorio_financeiro(date, date) to service_role;
grant execute on function public.relatorio_comercial(date, date) to service_role;
grant execute on function public.relatorio_estoque(integer) to service_role;
grant execute on function public.relatorio_atendimento(date, date) to service_role;
