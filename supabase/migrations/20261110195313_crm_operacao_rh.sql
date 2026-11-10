-- crm_operacao_rh
-- Tipos de notificacao ampliados
create or replace function public.tipos_notificacao()
returns text[] language sql immutable set search_path = '' as $$
  select array['LEAD_ATRIBUIDO','RECLAMACAO_ABERTA','RECLAMACAO_ATRIBUIDA','DEMANDA_ATRIBUIDA','CONTA_VENCENDO',
               'CONTA_VENCIDA','JORNADA_ETAPA','COMPROMISSO_PROXIMO','CANDIDATURA_RECEBIDA']
$$;
grant execute on function public.tipos_notificacao() to authenticated;
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo = any (public.tipos_notificacao()));
alter table public.preferencias_notificacao drop constraint preferencias_notificacao_tipo_check;
alter table public.preferencias_notificacao add constraint preferencias_notificacao_tipo_check check (tipo = any (public.tipos_notificacao()));

-- UTM nos leads
alter table public.leads
  add column utm_source text check (char_length(utm_source) <= 150),
  add column utm_medium text check (char_length(utm_medium) <= 150),
  add column utm_campaign text check (char_length(utm_campaign) <= 150),
  add column utm_term text check (char_length(utm_term) <= 150),
  add column utm_content text check (char_length(utm_content) <= 150);
create index leads_utm_campaign on public.leads (utm_campaign) where utm_campaign is not null;

-- Satisfacao
create table public.pesquisas_satisfacao (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 2 and 120),
  descricao text check (char_length(descricao) <= 500),
  tipo text not null default 'NPS' check (tipo in ('NPS','CSAT')),
  pergunta text not null default 'De 0 a 10, quanto você recomendaria nossa empresa a um amigo?' check (char_length(pergunta) <= 300),
  pergunta_comentario text default 'Conte o motivo da sua nota (opcional)' check (char_length(pergunta_comentario) <= 300),
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);
create table public.respostas_satisfacao (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.pesquisas_satisfacao(id) on delete cascade,
  nota integer not null check (nota between 0 and 10),
  comentario text check (char_length(comentario) <= 2000),
  cliente_id uuid references public.clientes(id) on delete set null,
  reclamacao_id uuid references public.reclamacoes(id) on delete set null,
  nome text check (char_length(nome) <= 150),
  email text check (char_length(email) <= 254),
  origem text not null default 'INTERNO' check (origem in ('LINK','INTERNO')),
  link_id uuid references public.links_publicos(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index respostas_satisfacao_pesquisa on public.respostas_satisfacao (pesquisa_id, criado_em desc);

create or replace function public.relatorio_satisfacao(p_inicio date, p_fim date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_total integer; v_prom integer; v_det integer; v_media numeric;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Informe um período válido: a data final deve ser igual ou posterior à inicial';
  end if;
  select count(*), count(*) filter (where nota >= 9), count(*) filter (where nota <= 6), round(avg(nota), 1)
    into v_total, v_prom, v_det, v_media
    from public.respostas_satisfacao where criado_em::date between p_inicio and p_fim;
  return jsonb_build_object(
    'indicadores', jsonb_build_array(
      jsonb_build_object('rotulo', 'Respostas', 'valor', v_total, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'NPS', 'valor', case when v_total = 0 then 0 else round((v_prom - v_det) * 100.0 / v_total) end, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Nota média', 'valor', coalesce(v_media, 0), 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Promotores', 'valor', v_prom, 'formato', 'numero'),
      jsonb_build_object('rotulo', 'Detratores', 'valor', v_det, 'formato', 'numero')),
    'graficos', jsonb_build_array(
      jsonb_build_object('titulo', 'Distribuição das notas', 'formato', 'numero', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', n::text, 'valor', qtd) order by n), '[]'::jsonb)
           from (select g.n, (select count(*) from public.respostas_satisfacao r
                               where r.nota = g.n and r.criado_em::date between p_inicio and p_fim) qtd
                   from generate_series(0, 10) g(n)) x)),
      jsonb_build_object('titulo', 'Respostas por pesquisa', 'formato', 'numero', 'itens',
        (select coalesce(jsonb_agg(jsonb_build_object('rotulo', titulo, 'valor', qtd) order by qtd desc), '[]'::jsonb)
           from (select p.titulo, count(*) qtd from public.respostas_satisfacao r
                   join public.pesquisas_satisfacao p on p.id = r.pesquisa_id
                  where r.criado_em::date between p_inicio and p_fim group by p.titulo) x))),
    'tabelas', jsonb_build_array(
      jsonb_build_object('titulo', 'Últimos comentários',
        'colunas', jsonb_build_array(
          jsonb_build_object('chave', 'data', 'rotulo', 'Data', 'formato', 'data'),
          jsonb_build_object('chave', 'nota', 'rotulo', 'Nota', 'formato', 'numero'),
          jsonb_build_object('chave', 'cliente', 'rotulo', 'Cliente', 'formato', 'texto'),
          jsonb_build_object('chave', 'comentario', 'rotulo', 'Comentário', 'formato', 'texto')),
        'linhas', (select coalesce(jsonb_agg(jsonb_build_object('data', criado_em::date, 'nota', nota, 'cliente', cliente, 'comentario', comentario) order by criado_em desc), '[]'::jsonb)
                     from (select r.criado_em, r.nota, coalesce(c.nome, r.nome, 'Anônimo') cliente, r.comentario
                             from public.respostas_satisfacao r left join public.clientes c on c.id = r.cliente_id
                            where r.criado_em::date between p_inicio and p_fim and nullif(btrim(r.comentario), '') is not null
                            order by r.criado_em desc limit 50) x))));
end;
$$;
revoke execute on function public.relatorio_satisfacao(date, date) from public, anon, authenticated;

create or replace function public.relatorio(p_tipo text, p_inicio date default null, p_fim date default null, p_limite integer default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pode_acessar('relatorios/' || p_tipo) then
    raise exception using errcode = '42501', message = 'sem_permissao';
  end if;
  return case p_tipo
    when 'financeiro' then public.relatorio_financeiro(p_inicio, p_fim)
    when 'comercial' then public.relatorio_comercial(p_inicio, p_fim)
    when 'atendimento' then public.relatorio_atendimento(p_inicio, p_fim)
    when 'estoque' then public.relatorio_estoque(least(greatest(coalesce(p_limite, 20), 1), 100))
    when 'dre' then public.relatorio_dre(p_inicio, p_fim)
    when 'satisfacao' then public.relatorio_satisfacao(p_inicio, p_fim)
    else null end;
end;
$$;

-- Jornadas de relacionamento
create table public.jornadas_relacionamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 2 and 80),
  descricao text check (char_length(descricao) <= 500),
  gatilho text not null default 'MANUAL' check (gatilho in ('MANUAL','CLIENTE_CRIADO','LEAD_CONVERTIDO','RECLAMACAO_RESOLVIDA','PEDIDO_FATURADO')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create table public.jornada_etapas (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid not null references public.jornadas_relacionamento(id) on delete cascade,
  ordem integer not null default 0,
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  dias_apos integer not null default 0 check (dias_apos between 0 and 730),
  acao text not null default 'TAREFA' check (acao in ('TAREFA','EMAIL','WHATSAPP','LIGACAO','PESQUISA')),
  modelo_id uuid references public.modelos_comunicacao(id) on delete set null,
  pesquisa_id uuid references public.pesquisas_satisfacao(id) on delete set null,
  instrucoes text check (char_length(instrucoes) <= 1000)
);
create index jornada_etapas_jornada on public.jornada_etapas (jornada_id, ordem);
create table public.jornada_participantes (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid not null references public.jornadas_relacionamento(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  etapa_atual_id uuid references public.jornada_etapas(id) on delete set null,
  status text not null default 'ATIVO' check (status in ('ATIVO','CONCLUIDO','CANCELADO')),
  iniciado_em timestamptz not null default now(),
  proxima_acao_em timestamptz,
  notificado_em timestamptz,
  concluido_em timestamptz,
  unique (jornada_id, cliente_id)
);
create index jornada_participantes_proxima on public.jornada_participantes (proxima_acao_em) where status = 'ATIVO';

create or replace function public.posicionar_participante()
returns trigger language plpgsql set search_path = '' as $$
declare
  e public.jornada_etapas;
begin
  if new.etapa_atual_id is null and new.status = 'ATIVO' then
    select * into e from public.jornada_etapas where jornada_id = new.jornada_id order by ordem, dias_apos limit 1;
    if found then
      new.etapa_atual_id := e.id;
      new.proxima_acao_em := new.iniciado_em + make_interval(days => e.dias_apos);
    end if;
  end if;
  return new;
end;
$$;
create trigger jornada_participantes_posicionar before insert on public.jornada_participantes
  for each row execute function public.posicionar_participante();

create or replace function public.avancar_jornada(p_participante uuid)
returns public.jornada_participantes language plpgsql set search_path = '' as $$
declare
  jp public.jornada_participantes;
  atual public.jornada_etapas;
  prox public.jornada_etapas;
begin
  select * into jp from public.jornada_participantes where id = p_participante for update;
  if not found or jp.status <> 'ATIVO' then
    raise exception using errcode = 'P0001', message = 'participante_inativo';
  end if;
  select * into atual from public.jornada_etapas where id = jp.etapa_atual_id;
  select * into prox from public.jornada_etapas
   where jornada_id = jp.jornada_id and (ordem, dias_apos, id::text) > (atual.ordem, atual.dias_apos, atual.id::text)
   order by ordem, dias_apos, id::text limit 1;
  if prox.id is null then
    update public.jornada_participantes
       set status = 'CONCLUIDO', concluido_em = now(), etapa_atual_id = null, proxima_acao_em = null
     where id = p_participante returning * into jp;
  else
    update public.jornada_participantes
       set etapa_atual_id = prox.id, notificado_em = null,
           proxima_acao_em = greatest(now(), jp.iniciado_em + make_interval(days => prox.dias_apos))
     where id = p_participante returning * into jp;
  end if;
  return jp;
end;
$$;

create or replace function public.inscrever_em_jornadas(p_gatilho text, p_cliente uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.jornada_participantes (jornada_id, cliente_id)
  select j.id, p_cliente from public.jornadas_relacionamento j
   where j.ativo and j.gatilho = p_gatilho and p_cliente is not null
  on conflict (jornada_id, cliente_id) do nothing
$$;
revoke execute on function public.inscrever_em_jornadas(text, uuid) from public, anon, authenticated;

create or replace function public.gatilhos_de_jornada()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  case tg_table_name
  when 'clientes' then
    perform public.inscrever_em_jornadas('CLIENTE_CRIADO', new.id);
  when 'leads' then
    if old.cliente_id is null and new.cliente_id is not null then
      perform public.inscrever_em_jornadas('LEAD_CONVERTIDO', new.cliente_id);
    end if;
  when 'reclamacoes' then
    if new.status = 'RESOLVIDA' and old.status is distinct from 'RESOLVIDA' then
      perform public.inscrever_em_jornadas('RECLAMACAO_RESOLVIDA', new.cliente_id);
    end if;
  when 'pedidos_venda' then
    if new.status = 'FATURADO' and old.status is distinct from 'FATURADO' then
      perform public.inscrever_em_jornadas('PEDIDO_FATURADO', new.cliente_id);
    end if;
  else
    null;
  end case;
  return null;
end;
$$;
revoke execute on function public.gatilhos_de_jornada() from public, anon, authenticated;
create trigger clientes_jornada after insert on public.clientes for each row execute function public.gatilhos_de_jornada();
create trigger leads_jornada after update of cliente_id on public.leads for each row execute function public.gatilhos_de_jornada();
create trigger reclamacoes_jornada after update of status on public.reclamacoes for each row execute function public.gatilhos_de_jornada();
create trigger pedidos_jornada after update of status on public.pedidos_venda for each row execute function public.gatilhos_de_jornada();

create or replace function public.processar_jornadas()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_qtd integer := 0;
begin
  for r in
    select jp.id, jp.cliente_id, j.nome jornada, e.nome etapa, e.acao, c.nome cliente, c.responsavel_id
      from public.jornada_participantes jp
      join public.jornadas_relacionamento j on j.id = jp.jornada_id
      join public.jornada_etapas e on e.id = jp.etapa_atual_id
      join public.clientes c on c.id = jp.cliente_id
     where jp.status = 'ATIVO' and jp.notificado_em is null and jp.proxima_acao_em <= now()
  loop
    perform public.notificar(r.responsavel_id, 'JORNADA_ETAPA',
      left(r.jornada || ': ' || r.etapa, 150), left('Cliente ' || r.cliente || ' aguarda a etapa "' || r.etapa || '".', 500),
      '/crm/jornadas', 'jornada:' || r.id || ':' || r.etapa);
    update public.jornada_participantes set notificado_em = now() where id = r.id;
    v_qtd := v_qtd + 1;
  end loop;
  return v_qtd;
end;
$$;
revoke execute on function public.processar_jornadas() from public, anon, authenticated;
select cron.schedule('processar-jornadas', '0 * * * *', $$select public.processar_jornadas()$$);

-- Quadros kanban configuraveis
create table public.quadros_kanban (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 2 and 60),
  descricao text check (char_length(descricao) <= 300),
  cor text check (cor ~ '^#[0-9a-fA-F]{6}$'),
  padrao boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index quadros_kanban_um_padrao on public.quadros_kanban (padrao) where padrao;
create table public.quadro_kanban_colunas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references public.quadros_kanban(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 40),
  ordem integer not null default 0,
  cor text check (cor ~ '^#[0-9a-fA-F]{6}$'),
  status_equivalente text not null default 'A_FAZER' check (status_equivalente in ('A_FAZER','EM_ANDAMENTO','EM_REVISAO','CONCLUIDO')),
  limite_wip integer check (limite_wip > 0)
);
create index quadro_colunas_quadro on public.quadro_kanban_colunas (quadro_id, ordem);

with q as (
  insert into public.quadros_kanban (nome, descricao, padrao) values ('Geral', 'Quadro padrão de demandas', true) returning id
)
insert into public.quadro_kanban_colunas (quadro_id, nome, ordem, status_equivalente)
select q.id, c.nome, c.ordem, c.status from q,
  (values ('A fazer', 1, 'A_FAZER'), ('Em andamento', 2, 'EM_ANDAMENTO'), ('Em revisão', 3, 'EM_REVISAO'), ('Concluído', 4, 'CONCLUIDO')) c(nome, ordem, status);

alter table public.demandas
  add column quadro_id uuid references public.quadros_kanban(id) on delete set null,
  add column coluna_id uuid references public.quadro_kanban_colunas(id) on delete set null;
create index demandas_coluna on public.demandas (coluna_id, ordem);

update public.demandas d
   set quadro_id = c.quadro_id, coluna_id = c.id
  from public.quadro_kanban_colunas c join public.quadros_kanban q on q.id = c.quadro_id and q.padrao
 where c.status_equivalente = d.status;

create or replace function public.demanda_no_quadro()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_quadro uuid;
  v_status text;
begin
  if new.quadro_id is null then
    select id into new.quadro_id from public.quadros_kanban where padrao limit 1;
  end if;
  if new.coluna_id is not null and (tg_op = 'INSERT' or new.coluna_id is distinct from old.coluna_id) then
    select quadro_id, status_equivalente into v_quadro, v_status from public.quadro_kanban_colunas where id = new.coluna_id;
    new.quadro_id := v_quadro;
    new.status := v_status;
  elsif tg_op = 'UPDATE' and (new.status is distinct from old.status or new.quadro_id is distinct from old.quadro_id) then
    new.coluna_id := null;
  end if;
  if new.coluna_id is null then
    select id into new.coluna_id from public.quadro_kanban_colunas
     where quadro_id = new.quadro_id and status_equivalente = new.status order by ordem limit 1;
  end if;
  if new.coluna_id is null then
    select id, status_equivalente into new.coluna_id, v_status from public.quadro_kanban_colunas
     where quadro_id = new.quadro_id order by ordem limit 1;
    if v_status is not null then
      new.status := v_status;
    end if;
  end if;
  return new;
end;
$$;
create trigger demandas_quadro before insert or update of status, coluna_id, quadro_id on public.demandas
  for each row execute function public.demanda_no_quadro();

create or replace function public.mover_demanda_coluna(p_id uuid, p_coluna_id uuid, p_posicao integer)
returns setof public.demandas language plpgsql set search_path = '' as $$
begin
  update public.demandas d
     set ordem = case when o.pos >= p_posicao then o.pos + 1 else o.pos end
    from (select id, (row_number() over (order by ordem, criado_em) - 1)::integer as pos
            from public.demandas
           where coluna_id = p_coluna_id and id <> p_id) o
   where d.id = o.id and d.ordem is distinct from (case when o.pos >= p_posicao then o.pos + 1 else o.pos end);
  return query
    update public.demandas
       set coluna_id = p_coluna_id, ordem = greatest(p_posicao, 0)
     where id = p_id
    returning *;
end;
$$;

-- Roteiros (modelos de checklist)
create table public.roteiros_checklist (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 2 and 80),
  descricao text check (char_length(descricao) <= 500),
  categoria text check (char_length(categoria) <= 60),
  itens jsonb not null default '[]'::jsonb check (jsonb_typeof(itens) = 'array'),
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

create or replace function public.aplicar_roteiro(p_roteiro uuid, p_demanda uuid)
returns setof public.demandas language plpgsql set search_path = '' as $$
begin
  return query
    update public.demandas d
       set checklist = d.checklist || coalesce((
             select jsonb_agg(jsonb_build_object('texto', left(i ->> 'texto', 200), 'feito', false))
               from public.roteiros_checklist r, jsonb_array_elements(r.itens) i
              where r.id = p_roteiro and nullif(btrim(i ->> 'texto'), '') is not null), '[]'::jsonb)
     where d.id = p_demanda
    returning d.*;
end;
$$;

-- Agenda
create table public.compromissos_agenda (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 2 and 150),
  descricao text check (char_length(descricao) <= 2000),
  tipo text not null default 'REUNIAO' check (tipo in ('REUNIAO','VISITA','LIGACAO','TAREFA','OUTRO')),
  inicio timestamptz not null,
  fim timestamptz,
  dia_inteiro boolean not null default false,
  local text check (char_length(local) <= 200),
  responsavel_id uuid default auth.uid() references public.perfis(id) on delete set null,
  participantes uuid[] not null default '{}',
  cliente_id uuid references public.clientes(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  lembrete_minutos integer check (lembrete_minutos between 0 and 10080),
  lembrete_enviado_em timestamptz,
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index compromissos_inicio on public.compromissos_agenda (inicio);

create or replace function public.lembrar_compromissos()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  u uuid;
  v_qtd integer := 0;
begin
  for r in select * from public.compromissos_agenda
            where lembrete_minutos is not null and lembrete_enviado_em is null
              and inicio - make_interval(mins => lembrete_minutos) <= now() and inicio > now() - interval '1 hour'
  loop
    foreach u in array array_append(r.participantes, r.responsavel_id) loop
      perform public.notificar(u, 'COMPROMISSO_PROXIMO', left('Compromisso: ' || r.titulo, 150),
        'Início ' || to_char(r.inicio at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), '/demandas/agenda',
        'compromisso:' || r.id || ':' || u);
    end loop;
    update public.compromissos_agenda set lembrete_enviado_em = now() where id = r.id;
    v_qtd := v_qtd + 1;
  end loop;
  return v_qtd;
end;
$$;
revoke execute on function public.lembrar_compromissos() from public, anon, authenticated;
select cron.schedule('lembrar-compromissos', '*/5 * * * *', $$select public.lembrar_compromissos()$$);

-- RH
create table public.vagas_emprego (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  titulo text not null check (char_length(btrim(titulo)) between 2 and 120),
  departamento text check (char_length(departamento) <= 60),
  descricao text check (char_length(descricao) <= 5000),
  requisitos text check (char_length(requisitos) <= 3000),
  local text check (char_length(local) <= 120),
  modalidade text not null default 'PRESENCIAL' check (modalidade in ('PRESENCIAL','REMOTO','HIBRIDO')),
  tipo_contrato text not null default 'CLT' check (tipo_contrato in ('CLT','PJ','ESTAGIO','TEMPORARIO','FREELANCER')),
  faixa_salarial text check (char_length(faixa_salarial) <= 60),
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO','ABERTA','PAUSADA','ENCERRADA')),
  publica boolean not null default false,
  abertura date,
  encerramento date,
  responsavel_id uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger vagas_atualizado_em before update on public.vagas_emprego
  for each row execute function public.tocar_atualizado_em();
create trigger vagas_codigo before insert on public.vagas_emprego
  for each row execute function public.numerar_documento('vaga');
alter table public.vagas_emprego rename column codigo to numero;

create table public.pessoas_candidatas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 150),
  email text not null check (char_length(email) between 5 and 254),
  telefone text check (char_length(telefone) <= 30),
  cidade text check (char_length(cidade) <= 100),
  linkedin_url text check (char_length(linkedin_url) <= 300),
  portfolio_url text check (char_length(portfolio_url) <= 300),
  resumo text check (char_length(resumo) <= 3000),
  curriculo_caminho text check (char_length(curriculo_caminho) <= 400),
  origem text not null default 'SITE' check (origem in ('SITE','INDICACAO','LINKEDIN','OUTRO')),
  consentimento_em timestamptz,
  extras jsonb not null default '{}'::jsonb check (jsonb_typeof(extras) = 'object'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index pessoas_candidatas_email on public.pessoas_candidatas (lower(email));
create trigger pessoas_candidatas_atualizado_em before update on public.pessoas_candidatas
  for each row execute function public.tocar_atualizado_em();

create table public.candidaturas_vaga (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.vagas_emprego(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas_candidatas(id) on delete cascade,
  etapa text not null default 'TRIAGEM' check (etapa in ('TRIAGEM','ENTREVISTA','TESTE','PROPOSTA','CONTRATADO','REPROVADO','DESISTIU')),
  avaliacao integer check (avaliacao between 1 and 5),
  observacoes text check (char_length(observacoes) <= 2000),
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (vaga_id, pessoa_id)
);
create index candidaturas_vaga_etapa on public.candidaturas_vaga (vaga_id, etapa, ordem);
create trigger candidaturas_atualizado_em before update on public.candidaturas_vaga
  for each row execute function public.tocar_atualizado_em();

create or replace function public.candidatura_recebida()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v record;
begin
  select v.titulo, v.responsavel_id, p.nome into v
    from public.vagas_emprego v, public.pessoas_candidatas p
   where v.id = new.vaga_id and p.id = new.pessoa_id;
  perform public.notificar(v.responsavel_id, 'CANDIDATURA_RECEBIDA', left('Nova candidatura: ' || v.titulo, 150),
    left(v.nome || ' se candidatou.', 500), '/rh/vagas', 'candidatura:' || new.id);
  perform public.enfileirar_evento('candidatura.recebida', to_jsonb(new));
  return null;
end;
$$;
revoke execute on function public.candidatura_recebida() from public, anon, authenticated;
create trigger candidaturas_recebida after insert on public.candidaturas_vaga
  for each row execute function public.candidatura_recebida();

create or replace function public.satisfacao_respondida()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enfileirar_evento('satisfacao.respondida', to_jsonb(new));
  return null;
end;
$$;
revoke execute on function public.satisfacao_respondida() from public, anon, authenticated;
create trigger respostas_satisfacao_evento after insert on public.respostas_satisfacao
  for each row execute function public.satisfacao_respondida();

-- Agenda consolidada (respeita o RLS de cada origem)
create view public.agenda_consolidada with (security_invoker = true) as
  select 'COMPROMISSO'::text origem, c.id registro_id, c.titulo, c.inicio, c.fim, c.dia_inteiro, c.responsavel_id, '/demandas/agenda'::text link
    from public.compromissos_agenda c
  union all
  select 'DEMANDA', d.id, d.titulo, d.prazo::timestamptz, null, true, (d.responsaveis[1])::uuid, '/demandas/quadro'
    from public.demandas d where d.prazo is not null and d.status <> 'CONCLUIDO'
  union all
  select 'CONTA_PAGAR', p.id, 'Pagar: ' || p.descricao, p.vencimento::timestamptz, null, true, p.criado_por, '/financeiro/contas-pagar'
    from public.contas_pagar p where p.status = 'PENDENTE'
  union all
  select 'CONTA_RECEBER', r.id, 'Receber: ' || r.descricao, r.vencimento::timestamptz, null, true, r.criado_por, '/financeiro/contas-receber'
    from public.contas_receber r where r.status = 'PENDENTE'
  union all
  select 'LEAD', l.id, coalesce(l.proxima_acao, 'Próxima ação') || ' – ' || l.nome, l.proxima_acao_em::timestamptz, null, false, l.responsavel_id, '/crm/leads'
    from public.leads l where l.proxima_acao_em is not null and l.cliente_id is null
  union all
  select 'RECLAMACAO', rc.id, 'Prazo: ' || rc.protocolo || ' ' || rc.assunto, rc.prazo::timestamptz, null, true, rc.responsavel_id, '/crm/reclamacoes'
    from public.reclamacoes rc where rc.prazo is not null and rc.status in ('ABERTA','EM_ANALISE')
  union all
  select 'PROPOSTA', pc.id, 'Validade: ' || pc.numero || ' ' || pc.titulo, pc.validade::timestamptz, null, true, pc.responsavel_id, '/comercial/propostas'
    from public.propostas_comerciais pc where pc.validade is not null and pc.status in ('RASCUNHO','ENVIADA');
grant select on public.agenda_consolidada to authenticated;

-- RLS
do $$
declare r record;
begin
  for r in select * from (values
    ('pesquisas_satisfacao', 'crm', 'crm/pesquisas'),
    ('respostas_satisfacao', 'crm', 'crm/pesquisas'),
    ('jornadas_relacionamento', 'crm', 'crm/jornadas'),
    ('jornada_etapas', 'crm', 'crm/jornadas'),
    ('jornada_participantes', 'crm', 'crm/jornadas'),
    ('quadros_kanban', 'demandas', 'demandas/quadros'),
    ('quadro_kanban_colunas', 'demandas', 'demandas/quadros'),
    ('roteiros_checklist', 'demandas', 'demandas/roteiros'),
    ('compromissos_agenda', 'demandas/agenda', 'demandas/agenda'),
    ('pessoas_candidatas', 'rh', 'rh/candidatos'),
    ('candidaturas_vaga', 'rh', 'rh')
  ) v(tabela, ler, gravar) loop
    execute format('alter table public.%I enable row level security', r.tabela);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.pode_acessar(%L)))', r.tabela || '_ler', r.tabela, r.ler);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.pode_acessar(%L)))', r.tabela || '_incluir', r.tabela, r.gravar);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.pode_acessar(%L))) with check ((select public.pode_acessar(%L)))', r.tabela || '_alterar', r.tabela, r.gravar, r.gravar);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.pode_acessar(%L)))', r.tabela || '_excluir', r.tabela, r.gravar);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.tabela);
  end loop;
end $$;

alter table public.vagas_emprego enable row level security;
create policy vagas_publicas on public.vagas_emprego for select to anon using (publica and status = 'ABERTA');
create policy vagas_ler on public.vagas_emprego for select to authenticated
  using ((publica and status = 'ABERTA') or (select public.pode_acessar('rh')));
create policy vagas_incluir on public.vagas_emprego for insert to authenticated with check ((select public.pode_acessar('rh/vagas')));
create policy vagas_alterar on public.vagas_emprego for update to authenticated
  using ((select public.pode_acessar('rh/vagas'))) with check ((select public.pode_acessar('rh/vagas')));
create policy vagas_excluir on public.vagas_emprego for delete to authenticated using ((select public.pode_acessar('rh/vagas')));
grant select (id, numero, titulo, departamento, descricao, requisitos, local, modalidade, tipo_contrato, faixa_salarial, status, publica, abertura, encerramento)
  on public.vagas_emprego to anon;
grant select, insert, update, delete on public.vagas_emprego to authenticated;

grant execute on function public.avancar_jornada(uuid), public.mover_demanda_coluna(uuid, uuid, integer),
  public.aplicar_roteiro(uuid, uuid)
to authenticated;

do $$
declare t text;
begin
  foreach t in array array['pesquisas_satisfacao','jornadas_relacionamento','quadros_kanban','roteiros_checklist',
                           'compromissos_agenda','vagas_emprego','pessoas_candidatas','candidaturas_vaga'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t || '_auditoria', t);
  end loop;
end $$;
