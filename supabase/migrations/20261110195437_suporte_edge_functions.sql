-- suporte_edge_functions
create extension if not exists pg_net with schema extensions;

alter table public.fila_eventos add column entregues uuid[] not null default '{}';

-- Token interno usado pelo agendador para chamar a funcao de despacho
select vault.create_secret(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
                           'fila_eventos_token', 'Autoriza o agendador a acionar webhooks-saida');

create or replace function public.token_da_fila()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'fila_eventos_token' limit 1
$$;
revoke execute on function public.token_da_fila() from public, anon, authenticated;

create or replace function public.reservar_eventos(p_limite integer default 20)
returns setof public.fila_eventos language sql security definer set search_path = '' as $$
  update public.fila_eventos f
     set tentativas = f.tentativas + 1, proxima_tentativa_em = now() + interval '5 minutes'
   where f.id in (select id from public.fila_eventos
                   where processado_em is null and proxima_tentativa_em <= now() and tentativas < 3
                   order by id limit least(greatest(p_limite, 1), 100)
                   for update skip locked)
  returning f.*
$$;
revoke execute on function public.reservar_eventos(integer) from public, anon, authenticated;

create or replace function public.despachar_webhooks()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.fila_eventos where processado_em is null and proxima_tentativa_em <= now() and tentativas < 3) then
    perform net.http_post(
      url := 'https://SEU-PROJETO.supabase.co/functions/v1/webhooks-saida',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-fila-token', public.token_da_fila()),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000);
  end if;
end;
$$;
revoke execute on function public.despachar_webhooks() from public, anon, authenticated;
select cron.schedule('despachar-webhooks', '* * * * *', $$select public.despachar_webhooks()$$);

-- Lead recebido por webhook de entrada ou formulario publico
create or replace function public.criar_lead_externo(p_dados jsonb, p_origem_id uuid, p_descricao_origem text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.leads (nome, empresa, email, telefone, valor_estimado, observacoes, origem_id, etapa_id,
                            utm_source, utm_medium, utm_campaign, utm_term, utm_content)
  values (left(btrim(p_dados ->> 'nome'), 150), left(nullif(btrim(p_dados ->> 'empresa'), ''), 150),
          left(nullif(btrim(p_dados ->> 'email'), ''), 254), left(nullif(btrim(p_dados ->> 'telefone'), ''), 30),
          nullif(p_dados ->> 'valorEstimado', '')::numeric, left(nullif(btrim(p_dados ->> 'mensagem'), ''), 2000),
          p_origem_id, (select id from public.crm_etapas where ativo order by ordem limit 1),
          left(nullif(p_dados ->> 'utm_source', ''), 150), left(nullif(p_dados ->> 'utm_medium', ''), 150),
          left(nullif(p_dados ->> 'utm_campaign', ''), 150), left(nullif(p_dados ->> 'utm_term', ''), 150),
          left(nullif(p_dados ->> 'utm_content', ''), 150))
  returning id into v_id;
  insert into public.crm_interacoes (lead_id, tipo, descricao)
  values (v_id, 'NOTA', left('Lead recebido por "' || p_descricao_origem || '".', 2000));
  return v_id;
end;
$$;
revoke execute on function public.criar_lead_externo(jsonb, uuid, text) from public, anon, authenticated;

create or replace function public.receber_lead_webhook(p_token text, p_dados jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  e public.webhooks_entrada;
  v_id uuid;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    return null;
  end if;
  select * into e from public.webhooks_entrada where token = p_token and ativo;
  if not found then
    return null;
  end if;
  v_id := public.criar_lead_externo(p_dados, e.origem_id, 'integração ' || e.nome);
  update public.webhooks_entrada set total_recebidos = total_recebidos + 1, ultimo_uso_em = now() where id = e.id;
  return v_id;
end;
$$;
revoke execute on function public.receber_lead_webhook(text, jsonb) from public, anon, authenticated;

-- Links publicos
create or replace function public.link_publico_valido(p_token text)
returns public.links_publicos language sql stable security definer set search_path = '' as $$
  select * from public.links_publicos
   where p_token ~ '^[a-f0-9]{64}$' and token = p_token and ativo
     and (expira_em is null or expira_em > now())
     and (usos_maximos is null or usos < usos_maximos)
$$;
revoke execute on function public.link_publico_valido(text) from public, anon, authenticated;

create or replace function public.conteudo_link_publico(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  l public.links_publicos;
  v_extra jsonb := '{}'::jsonb;
begin
  l := public.link_publico_valido(p_token);
  if l.id is null then
    return null;
  end if;
  if l.tipo = 'PESQUISA_SATISFACAO' then
    select jsonb_build_object('pesquisa', jsonb_build_object('titulo', p.titulo, 'descricao', p.descricao, 'tipo', p.tipo,
                              'pergunta', p.pergunta, 'perguntaComentario', p.pergunta_comentario))
      into v_extra from public.pesquisas_satisfacao p
     where p.id = coalesce((l.configuracao ->> 'pesquisa_id')::uuid, l.registro_id) and p.ativo;
  elsif l.tipo = 'PROPOSTA' then
    select jsonb_build_object('proposta', jsonb_build_object(
             'numero', p.numero, 'titulo', p.titulo, 'status', p.status, 'validade', p.validade,
             'condicoesPagamento', p.condicoes_pagamento, 'observacoes', p.observacoes,
             'descontoGeral', p.desconto_geral, 'valorProdutos', p.valor_produtos, 'valorTotal', p.valor_total,
             'itens', (select coalesce(jsonb_agg(jsonb_build_object('descricao', i.descricao, 'quantidade', i.quantidade,
                               'precoUnitario', i.preco_unitario, 'descontoPercentual', i.desconto_percentual,
                               'valorTotal', i.valor_total) order by i.ordem), '[]'::jsonb)
                         from public.proposta_itens i where i.proposta_id = p.id)))
      into v_extra from public.propostas_comerciais p where p.id = l.registro_id;
  elsif l.tipo = 'VAGA' then
    select jsonb_build_object('vaga', jsonb_build_object('id', v.id, 'titulo', v.titulo, 'descricao', v.descricao,
             'requisitos', v.requisitos, 'local', v.local, 'modalidade', v.modalidade, 'tipoContrato', v.tipo_contrato))
      into v_extra from public.vagas_emprego v where v.id = l.registro_id and v.status = 'ABERTA';
  end if;
  return jsonb_build_object('tipo', l.tipo, 'titulo', l.titulo,
                            'configuracao', l.configuracao - 'origem_id' - 'pesquisa_id') || coalesce(v_extra, '{}'::jsonb);
end;
$$;
revoke execute on function public.conteudo_link_publico(text) from public, anon, authenticated;

create or replace function public.candidatar_em_vaga(p_vaga uuid, p_dados jsonb, p_curriculo text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_pessoa uuid;
  v_candidatura uuid;
begin
  if not exists (select 1 from public.vagas_emprego where id = p_vaga and status = 'ABERTA') then
    raise exception using errcode = 'P0001', message = 'vaga_indisponivel';
  end if;
  insert into public.pessoas_candidatas (nome, email, telefone, cidade, linkedin_url, portfolio_url, resumo, curriculo_caminho, origem, consentimento_em)
  values (left(btrim(p_dados ->> 'nome'), 150), lower(left(btrim(p_dados ->> 'email'), 254)),
          left(nullif(btrim(p_dados ->> 'telefone'), ''), 30), left(nullif(btrim(p_dados ->> 'cidade'), ''), 100),
          left(nullif(btrim(p_dados ->> 'linkedinUrl'), ''), 300), left(nullif(btrim(p_dados ->> 'portfolioUrl'), ''), 300),
          left(nullif(btrim(p_dados ->> 'resumo'), ''), 3000), p_curriculo, 'SITE', now())
  on conflict (lower(email)) do update
    set nome = excluded.nome,
        telefone = coalesce(excluded.telefone, public.pessoas_candidatas.telefone),
        cidade = coalesce(excluded.cidade, public.pessoas_candidatas.cidade),
        linkedin_url = coalesce(excluded.linkedin_url, public.pessoas_candidatas.linkedin_url),
        portfolio_url = coalesce(excluded.portfolio_url, public.pessoas_candidatas.portfolio_url),
        resumo = coalesce(excluded.resumo, public.pessoas_candidatas.resumo),
        curriculo_caminho = coalesce(excluded.curriculo_caminho, public.pessoas_candidatas.curriculo_caminho),
        consentimento_em = now()
  returning id into v_pessoa;
  insert into public.candidaturas_vaga (vaga_id, pessoa_id) values (p_vaga, v_pessoa)
  on conflict (vaga_id, pessoa_id) do update set atualizado_em = now()
  returning id into v_candidatura;
  return v_candidatura;
end;
$$;
revoke execute on function public.candidatar_em_vaga(uuid, jsonb, text) from public, anon, authenticated;

create or replace function public.responder_link_publico(p_token text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l public.links_publicos;
  v_id uuid;
  v_nota integer;
begin
  select * into l from public.links_publicos where id = (public.link_publico_valido(p_token)).id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'link_invalido';
  end if;
  if l.tipo = 'FORMULARIO_LEAD' then
    v_id := public.criar_lead_externo(p_dados, (l.configuracao ->> 'origem_id')::uuid, 'formulário ' || l.titulo);
  elsif l.tipo = 'PESQUISA_SATISFACAO' then
    v_nota := (p_dados ->> 'nota')::integer;
    insert into public.respostas_satisfacao (pesquisa_id, nota, comentario, cliente_id, nome, email, origem, link_id)
    values (coalesce((l.configuracao ->> 'pesquisa_id')::uuid, l.registro_id), v_nota,
            left(nullif(btrim(p_dados ->> 'comentario'), ''), 2000),
            case when l.entidade = 'clientes' then l.registro_id end,
            left(nullif(btrim(p_dados ->> 'nome'), ''), 150), left(nullif(btrim(p_dados ->> 'email'), ''), 254),
            'LINK', l.id)
    returning id into v_id;
  elsif l.tipo = 'PROPOSTA' then
    if p_dados ->> 'decisao' = 'APROVAR' then
      v_id := public.aprovar_proposta(l.registro_id);
    elsif p_dados ->> 'decisao' = 'RECUSAR' then
      update public.propostas_comerciais
         set status = 'RECUSADA', decidida_em = now(), motivo_recusa = left(nullif(btrim(p_dados ->> 'motivo'), ''), 300)
       where id = l.registro_id and status in ('RASCUNHO', 'ENVIADA')
      returning id into v_id;
      if v_id is null then
        raise exception using errcode = 'P0001', message = 'proposta_encerrada';
      end if;
    else
      raise exception using errcode = '22023', message = 'decisao_invalida';
    end if;
  elsif l.tipo = 'VAGA' then
    v_id := public.candidatar_em_vaga(l.registro_id, p_dados, p_dados ->> 'curriculoCaminho');
  end if;
  update public.links_publicos set usos = usos + 1 where id = l.id;
  return jsonb_build_object('id', v_id, 'tipo', l.tipo);
end;
$$;
revoke execute on function public.responder_link_publico(text, jsonb) from public, anon, authenticated;

-- Aprovacao tambem pelo link publico (servidor, sem usuario logado)
create or replace function public.aprovar_proposta(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.propostas_comerciais;
  v_cliente uuid;
  v_pedido uuid;
begin
  if (select auth.uid()) is not null and not public.pode_acessar('comercial/propostas') then
    raise exception using errcode = '42501', message = 'sem_permissao';
  end if;
  if (select auth.uid()) is null and coalesce((select auth.role()), '') <> 'service_role' and current_user not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'sem_permissao';
  end if;
  select * into p from public.propostas_comerciais where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'proposta_nao_encontrada';
  end if;
  if p.status not in ('RASCUNHO', 'ENVIADA') then
    raise exception using errcode = 'P0001', message = 'proposta_encerrada';
  end if;
  if p.validade is not null and p.validade < current_date then
    raise exception using errcode = 'P0001', message = 'proposta_vencida';
  end if;
  if not exists (select 1 from public.proposta_itens where proposta_id = p_id) then
    raise exception using errcode = 'P0001', message = 'proposta_sem_itens';
  end if;
  v_cliente := coalesce(p.cliente_id, (select cliente_id from public.leads where id = p.lead_id));
  if v_cliente is null then
    raise exception using errcode = 'P0001', message = 'proposta_sem_cliente';
  end if;
  update public.propostas_comerciais set status = 'APROVADA', decidida_em = now(), cliente_id = v_cliente where id = p_id;
  insert into public.pedidos_venda (proposta_id, cliente_id, responsavel_id, condicoes_pagamento, observacoes, desconto_geral, extras)
  values (p_id, v_cliente, p.responsavel_id, p.condicoes_pagamento, p.observacoes, p.desconto_geral, p.extras)
  returning id into v_pedido;
  insert into public.pedido_venda_itens (pedido_id, produto_id, descricao, quantidade, preco_unitario, desconto_percentual, ordem)
  select v_pedido, produto_id, descricao, quantidade, preco_unitario, desconto_percentual, ordem
    from public.proposta_itens where proposta_id = p_id;
  perform public.enfileirar_evento('proposta.aprovada',
    jsonb_build_object('proposta', (select to_jsonb(x) from public.propostas_comerciais x where x.id = p_id), 'pedido_id', v_pedido));
  return v_pedido;
end;
$$;
revoke execute on function public.aprovar_proposta(uuid) from public, anon;
grant execute on function public.aprovar_proposta(uuid) to authenticated;

-- Situacao das integracoes (sem expor segredos)
create or replace function public.status_integracoes()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'webhooksSaidaAtivos', (select count(*) from public.webhooks_saida where ativo),
    'webhooksEntradaAtivos', (select count(*) from public.webhooks_entrada where ativo),
    'filaPendente', (select count(*) from public.fila_eventos where processado_em is null),
    'falhas24h', (select count(*) from public.webhook_entregas where not sucesso and criado_em > now() - interval '24 hours'),
    'tarefas', (select coalesce(jsonb_agg(jsonb_build_object('nome', j.jobname, 'agenda', j.schedule, 'ativa', j.active,
                    'ultimaExecucao', (select max(d.start_time) from cron.job_run_details d where d.jobid = j.jobid),
                    'ultimoStatus', (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1))
                    order by j.jobname), '[]'::jsonb) from cron.job j))
$$;
revoke execute on function public.status_integracoes() from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
