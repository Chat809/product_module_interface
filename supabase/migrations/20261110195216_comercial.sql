-- comercial
create table public.tabelas_preco (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 2 and 80),
  descricao text check (char_length(descricao) <= 300),
  moeda text not null default 'BRL' check (moeda ~ '^[A-Z]{3}$'),
  vigencia_inicio date,
  vigencia_fim date,
  padrao boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (vigencia_fim is null or vigencia_inicio is null or vigencia_fim >= vigencia_inicio)
);
create unique index tabelas_preco_uma_padrao on public.tabelas_preco (padrao) where padrao;
create trigger tabelas_preco_atualizado_em before update on public.tabelas_preco
  for each row execute function public.tocar_atualizado_em();

create table public.tabela_preco_itens (
  id uuid primary key default gen_random_uuid(),
  tabela_id uuid not null references public.tabelas_preco(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  preco numeric(14,2) not null check (preco >= 0),
  desconto_maximo numeric(5,2) not null default 0 check (desconto_maximo between 0 and 100),
  unique (tabela_id, produto_id)
);

create table public.propostas_comerciais (
  id uuid primary key default gen_random_uuid(),
  numero text unique,
  titulo text not null check (char_length(btrim(titulo)) between 2 and 150),
  cliente_id uuid references public.clientes(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO','ENVIADA','APROVADA','RECUSADA')),
  validade date,
  tabela_preco_id uuid references public.tabelas_preco(id) on delete set null,
  responsavel_id uuid default auth.uid() references public.perfis(id) on delete set null,
  condicoes_pagamento text check (char_length(condicoes_pagamento) <= 500),
  observacoes text check (char_length(observacoes) <= 2000),
  desconto_geral numeric(14,2) not null default 0 check (desconto_geral >= 0),
  valor_produtos numeric(14,2) not null default 0,
  valor_total numeric(14,2) not null default 0,
  motivo_recusa text check (char_length(motivo_recusa) <= 300),
  enviada_em timestamptz,
  decidida_em timestamptz,
  extras jsonb not null default '{}'::jsonb check (jsonb_typeof(extras) = 'object'),
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (cliente_id is not null or lead_id is not null)
);
create index propostas_status on public.propostas_comerciais (status, criado_em desc);
create index propostas_cliente on public.propostas_comerciais (cliente_id);
create trigger propostas_atualizado_em before update on public.propostas_comerciais
  for each row execute function public.tocar_atualizado_em();

create table public.proposta_itens (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas_comerciais(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  quantidade numeric(14,3) not null check (quantidade > 0),
  preco_unitario numeric(14,2) not null check (preco_unitario >= 0),
  desconto_percentual numeric(5,2) not null default 0 check (desconto_percentual between 0 and 100),
  valor_total numeric(14,2) generated always as (round(quantidade * preco_unitario * (1 - desconto_percentual / 100), 2)) stored,
  ordem integer not null default 0,
  check (produto_id is null or quantidade = trunc(quantidade))
);
create index proposta_itens_proposta on public.proposta_itens (proposta_id, ordem);

create table public.pedidos_venda (
  id uuid primary key default gen_random_uuid(),
  numero text unique,
  proposta_id uuid unique references public.propostas_comerciais(id) on delete set null,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  status text not null default 'ABERTO' check (status in ('ABERTO','FATURADO','CANCELADO')),
  data_pedido date not null default current_date,
  responsavel_id uuid default auth.uid() references public.perfis(id) on delete set null,
  condicoes_pagamento text check (char_length(condicoes_pagamento) <= 500),
  observacoes text check (char_length(observacoes) <= 2000),
  desconto_geral numeric(14,2) not null default 0 check (desconto_geral >= 0),
  valor_produtos numeric(14,2) not null default 0,
  valor_total numeric(14,2) not null default 0,
  faturado_em timestamptz,
  parcelamento_id uuid,
  conta_receber_id uuid references public.contas_receber(id) on delete set null,
  extras jsonb not null default '{}'::jsonb check (jsonb_typeof(extras) = 'object'),
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pedidos_status on public.pedidos_venda (status, data_pedido desc);
create index pedidos_cliente on public.pedidos_venda (cliente_id);
create trigger pedidos_atualizado_em before update on public.pedidos_venda
  for each row execute function public.tocar_atualizado_em();

create table public.pedido_venda_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_venda(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  quantidade numeric(14,3) not null check (quantidade > 0),
  preco_unitario numeric(14,2) not null check (preco_unitario >= 0),
  desconto_percentual numeric(5,2) not null default 0 check (desconto_percentual between 0 and 100),
  valor_total numeric(14,2) generated always as (round(quantidade * preco_unitario * (1 - desconto_percentual / 100), 2)) stored,
  ordem integer not null default 0,
  check (produto_id is null or quantidade = trunc(quantidade))
);
create index pedido_itens_pedido on public.pedido_venda_itens (pedido_id, ordem);

-- Numeracao automatica
create or replace function public.numerar_documento()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.numero is null then
    new.numero := public.proximo_numero(tg_argv[0]);
  end if;
  return new;
end;
$$;
revoke execute on function public.numerar_documento() from public, anon, authenticated;
create trigger propostas_numero before insert on public.propostas_comerciais
  for each row execute function public.numerar_documento('proposta');
create trigger pedidos_numero before insert on public.pedidos_venda
  for each row execute function public.numerar_documento('pedido');

-- Totais
create or replace function public.aplicar_desconto_geral()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.valor_total := greatest(new.valor_produtos - new.desconto_geral, 0);
  return new;
end;
$$;
create trigger propostas_total before insert or update of valor_produtos, desconto_geral on public.propostas_comerciais
  for each row execute function public.aplicar_desconto_geral();
create trigger pedidos_total before insert or update of valor_produtos, desconto_geral on public.pedidos_venda
  for each row execute function public.aplicar_desconto_geral();

create or replace function public.item_comercial_alterado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'proposta_itens' then
    update public.propostas_comerciais p
       set valor_produtos = coalesce((select sum(i.valor_total) from public.proposta_itens i where i.proposta_id = p.id), 0)
     where p.id = new.proposta_id or p.id = old.proposta_id;
  else
    update public.pedidos_venda p
       set valor_produtos = coalesce((select sum(i.valor_total) from public.pedido_venda_itens i where i.pedido_id = p.id), 0)
     where p.id = new.pedido_id or p.id = old.pedido_id;
  end if;
  return null;
end;
$$;
revoke execute on function public.item_comercial_alterado() from public, anon, authenticated;
create trigger proposta_itens_total after insert or update or delete on public.proposta_itens
  for each row execute function public.item_comercial_alterado();
create trigger pedido_itens_total after insert or update or delete on public.pedido_venda_itens
  for each row execute function public.item_comercial_alterado();

create or replace function public.bloquear_item_comercial()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_status text;
begin
  if tg_table_name = 'proposta_itens' then
    select status into v_status from public.propostas_comerciais where id = coalesce(new.proposta_id, old.proposta_id);
    if v_status in ('APROVADA', 'RECUSADA') and pg_trigger_depth() = 1 then
      raise exception using errcode = 'P0001', message = 'proposta_encerrada';
    end if;
  else
    select status into v_status from public.pedidos_venda where id = coalesce(new.pedido_id, old.pedido_id);
    if v_status <> 'ABERTO' and pg_trigger_depth() = 1 then
      raise exception using errcode = 'P0001', message = 'pedido_encerrado';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger proposta_itens_bloqueio before insert or update or delete on public.proposta_itens
  for each row execute function public.bloquear_item_comercial();
create trigger pedido_itens_bloqueio before insert or update or delete on public.pedido_venda_itens
  for each row execute function public.bloquear_item_comercial();

-- Comissoes e metas
create table public.regras_comissao (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  percentual numeric(5,2) not null check (percentual > 0 and percentual <= 100),
  usuario_id uuid references public.perfis(id) on delete cascade,
  categoria text check (char_length(categoria) <= 60),
  prioridade integer not null default 0,
  vigencia_inicio date,
  vigencia_fim date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.comissoes_apuradas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_venda(id) on delete cascade,
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  regra_id uuid references public.regras_comissao(id) on delete set null,
  competencia date not null,
  valor_base numeric(14,2) not null,
  percentual numeric(5,2) not null,
  valor_comissao numeric(14,2) not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','APROVADA','PAGA','CANCELADA')),
  conta_pagar_id uuid references public.contas_pagar(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index comissoes_usuario on public.comissoes_apuradas (usuario_id, competencia);

create table public.metas_comerciais (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.perfis(id) on delete cascade,
  periodo date not null check (extract(day from periodo) = 1),
  valor_meta numeric(14,2) not null check (valor_meta > 0),
  quantidade_meta integer check (quantidade_meta > 0),
  criado_em timestamptz not null default now(),
  unique nulls not distinct (usuario_id, periodo)
);

create or replace function public.aprovar_proposta(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.propostas_comerciais;
  v_cliente uuid;
  v_pedido uuid;
begin
  if not public.pode_acessar('comercial/propostas') then
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

  update public.propostas_comerciais
     set status = 'APROVADA', decidida_em = now(), cliente_id = v_cliente
   where id = p_id;

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

create or replace function public.apurar_comissoes(p_pedido_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pd public.pedidos_venda;
  v_fator numeric;
begin
  select * into pd from public.pedidos_venda where id = p_pedido_id;
  if pd.responsavel_id is null or pd.valor_produtos <= 0 then
    return;
  end if;
  v_fator := pd.valor_total / pd.valor_produtos;
  delete from public.comissoes_apuradas where pedido_id = p_pedido_id and status = 'PENDENTE';
  insert into public.comissoes_apuradas (pedido_id, usuario_id, regra_id, competencia, valor_base, percentual, valor_comissao)
  select p_pedido_id, pd.responsavel_id, r.id, date_trunc('month', coalesce(pd.faturado_em, now()))::date,
         round(sum(i.valor_total * v_fator), 2), r.percentual,
         round(sum(i.valor_total * v_fator) * r.percentual / 100, 2)
    from public.pedido_venda_itens i
    left join public.produtos pr on pr.id = i.produto_id
    cross join lateral (
      select rc.id, rc.percentual from public.regras_comissao rc
       where rc.ativo
         and (rc.usuario_id is null or rc.usuario_id = pd.responsavel_id)
         and (rc.categoria is null or rc.categoria = pr.categoria)
         and (rc.vigencia_inicio is null or rc.vigencia_inicio <= current_date)
         and (rc.vigencia_fim is null or rc.vigencia_fim >= current_date)
       order by (rc.usuario_id is not null) desc, (rc.categoria is not null) desc, rc.prioridade desc
       limit 1) r
   where i.pedido_id = p_pedido_id
   group by r.id, r.percentual;
end;
$$;
revoke execute on function public.apurar_comissoes(uuid) from public, anon, authenticated;

create or replace function public.faturar_pedido(p_id uuid, p_parcelas integer default 1, p_primeiro_vencimento date default null,
                                                 p_forma_pagamento text default 'BOLETO', p_conta_bancaria_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  pd public.pedidos_venda;
  i record;
  v_conta uuid;
  v_parcelamento uuid;
  v_plano uuid;
  v_nome text;
begin
  if not public.pode_acessar('comercial/pedidos') then
    raise exception using errcode = '42501', message = 'sem_permissao';
  end if;
  if p_forma_pagamento not in ('BOLETO','TRANSFERENCIA','CARTAO','DINHEIRO') then
    raise exception using errcode = '22023', message = 'forma_pagamento_invalida';
  end if;
  if p_parcelas is null or p_parcelas < 1 or p_parcelas > 120 then
    raise exception using errcode = '22023', message = 'parcelas_invalidas';
  end if;
  select * into pd from public.pedidos_venda where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'pedido_nao_encontrado';
  end if;
  if pd.status <> 'ABERTO' then
    raise exception using errcode = 'P0001', message = 'pedido_encerrado';
  end if;
  if pd.valor_total <= 0 then
    raise exception using errcode = 'P0001', message = 'pedido_sem_valor';
  end if;

  for i in select produto_id, sum(quantidade)::integer qtd from public.pedido_venda_itens
            where pedido_id = p_id and produto_id is not null group by produto_id loop
    perform public.registrar_movimentacao(i.produto_id, 'SAIDA', i.qtd, 'Pedido ' || pd.numero, (select auth.uid()));
  end loop;

  select nome into v_nome from public.clientes where id = pd.cliente_id;
  select id into v_plano from public.plano_contas where codigo = '1.1';
  insert into public.contas_receber (descricao, pagador, documento, categoria, valor, vencimento, competencia, forma_pagamento,
                                     cliente_id, plano_conta_id, conta_bancaria_id, criado_por)
  values (left('Pedido ' || pd.numero, 150), left(v_nome, 150), left(pd.numero, 30), 'Vendas', pd.valor_total,
          coalesce(p_primeiro_vencimento, current_date + 30), date_trunc('month', current_date)::date, p_forma_pagamento,
          pd.cliente_id, v_plano, p_conta_bancaria_id, (select auth.uid()))
  returning id into v_conta;
  if p_parcelas > 1 then
    v_parcelamento := public.parcelar_conta('RECEBER', v_conta, p_parcelas);
  end if;

  update public.pedidos_venda
     set status = 'FATURADO', faturado_em = now(), conta_receber_id = v_conta, parcelamento_id = v_parcelamento
   where id = p_id;
  perform public.apurar_comissoes(p_id);
  perform public.enfileirar_evento('pedido.faturado', (select to_jsonb(x) from public.pedidos_venda x where x.id = p_id));
  return v_conta;
end;
$$;

create or replace function public.ranking_comercial(p_periodo date)
returns table (usuario_id uuid, nome text, pedidos bigint, valor_faturado numeric, meta numeric,
               percentual_meta numeric, comissao numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_inicio date := date_trunc('month', coalesce(p_periodo, current_date))::date;
  v_fim date := (date_trunc('month', coalesce(p_periodo, current_date)) + interval '1 month')::date;
begin
  if not (public.pode_acessar('comercial') or public.pode_acessar('relatorios/comercial')) then
    raise exception using errcode = '42501', message = 'sem_permissao';
  end if;
  return query
  select p.id, p.nome,
         count(pd.id),
         coalesce(sum(pd.valor_total), 0)::numeric,
         m.valor_meta,
         case when m.valor_meta > 0 then round(coalesce(sum(pd.valor_total), 0) * 100 / m.valor_meta, 1) end,
         coalesce((select sum(c.valor_comissao) from public.comissoes_apuradas c
                    where c.usuario_id = p.id and c.competencia = v_inicio and c.status <> 'CANCELADA'), 0)::numeric
    from public.perfis p
    left join public.pedidos_venda pd on pd.responsavel_id = p.id and pd.status = 'FATURADO'
                                      and pd.faturado_em >= v_inicio and pd.faturado_em < v_fim
    left join public.metas_comerciais m on m.usuario_id = p.id and m.periodo = v_inicio
   group by p.id, p.nome, m.valor_meta
  having count(pd.id) > 0 or m.valor_meta is not null
   order by 4 desc;
end;
$$;

-- RLS
do $$
declare r record;
begin
  for r in select * from (values
    ('tabelas_preco', 'comercial', 'comercial/tabelas-preco'),
    ('tabela_preco_itens', 'comercial', 'comercial/tabelas-preco'),
    ('propostas_comerciais', 'comercial/propostas', 'comercial/propostas'),
    ('proposta_itens', 'comercial/propostas', 'comercial/propostas'),
    ('pedidos_venda', 'comercial/pedidos', 'comercial/pedidos'),
    ('pedido_venda_itens', 'comercial/pedidos', 'comercial/pedidos'),
    ('regras_comissao', 'comercial/comissoes', 'comercial/comissoes'),
    ('metas_comerciais', 'comercial', 'comercial/metas')
  ) v(tabela, ler, gravar) loop
    execute format('alter table public.%I enable row level security', r.tabela);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.pode_acessar(%L)))', r.tabela || '_ler', r.tabela, r.ler);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.pode_acessar(%L)))', r.tabela || '_incluir', r.tabela, r.gravar);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.pode_acessar(%L))) with check ((select public.pode_acessar(%L)))', r.tabela || '_alterar', r.tabela, r.gravar, r.gravar);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.pode_acessar(%L)))', r.tabela || '_excluir', r.tabela, r.gravar);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.tabela);
  end loop;
end $$;

alter table public.comissoes_apuradas enable row level security;
create policy comissoes_ler on public.comissoes_apuradas for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.pode_acessar('comercial/comissoes')));
create policy comissoes_alterar on public.comissoes_apuradas for update to authenticated
  using ((select public.pode_acessar('comercial/comissoes'))) with check ((select public.pode_acessar('comercial/comissoes')));
grant select on public.comissoes_apuradas to authenticated;
grant update (status, conta_pagar_id) on public.comissoes_apuradas to authenticated;

grant execute on function public.aprovar_proposta(uuid),
  public.faturar_pedido(uuid, integer, date, text, uuid), public.ranking_comercial(date)
to authenticated;

do $$
declare t text;
begin
  foreach t in array array['tabelas_preco','propostas_comerciais','pedidos_venda','regras_comissao','metas_comerciais','comissoes_apuradas'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t || '_auditoria', t);
  end loop;
end $$;
