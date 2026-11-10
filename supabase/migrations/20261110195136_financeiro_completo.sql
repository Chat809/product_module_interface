-- financeiro_completo
-- Contas bancarias e caixa
create table public.contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 2 and 80),
  tipo text not null default 'CORRENTE' check (tipo in ('CORRENTE','POUPANCA','CAIXA','CARTEIRA_DIGITAL','INVESTIMENTO')),
  banco text check (char_length(banco) <= 80),
  agencia text check (char_length(agencia) <= 20),
  numero text check (char_length(numero) <= 30),
  moeda text not null default 'BRL' check (moeda ~ '^[A-Z]{3}$'),
  saldo_inicial numeric(14,2) not null default 0,
  data_saldo_inicial date not null default current_date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger contas_bancarias_atualizado_em before update on public.contas_bancarias
  for each row execute function public.tocar_atualizado_em();

-- Plano de contas hierarquico com grupo da DRE
create table public.plano_contas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[0-9]+(\.[0-9]+)*$'),
  nome text not null check (char_length(btrim(nome)) between 2 and 100),
  natureza text not null check (natureza in ('RECEITA','DESPESA')),
  grupo_dre text not null check (grupo_dre in ('RECEITA_BRUTA','DEDUCOES','CUSTOS','DESPESAS_OPERACIONAIS',
                                               'RECEITAS_FINANCEIRAS','DESPESAS_FINANCEIRAS','IMPOSTOS_SOBRE_LUCRO')),
  pai_id uuid references public.plano_contas(id) on delete restrict,
  aceita_lancamento boolean not null default true,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index plano_contas_pai on public.plano_contas(pai_id);

insert into public.plano_contas (codigo, nome, natureza, grupo_dre, aceita_lancamento) values
  ('1', 'Receitas', 'RECEITA', 'RECEITA_BRUTA', false),
  ('1.1', 'Vendas de produtos', 'RECEITA', 'RECEITA_BRUTA', true),
  ('1.2', 'Prestação de serviços', 'RECEITA', 'RECEITA_BRUTA', true),
  ('1.3', 'Receitas financeiras', 'RECEITA', 'RECEITAS_FINANCEIRAS', true),
  ('2', 'Deduções', 'DESPESA', 'DEDUCOES', false),
  ('2.1', 'Impostos sobre vendas', 'DESPESA', 'DEDUCOES', true),
  ('2.2', 'Devoluções e descontos', 'DESPESA', 'DEDUCOES', true),
  ('3', 'Custos', 'DESPESA', 'CUSTOS', false),
  ('3.1', 'Mercadorias e insumos', 'DESPESA', 'CUSTOS', true),
  ('3.2', 'Serviços de terceiros', 'DESPESA', 'CUSTOS', true),
  ('4', 'Despesas operacionais', 'DESPESA', 'DESPESAS_OPERACIONAIS', false),
  ('4.1', 'Pessoal', 'DESPESA', 'DESPESAS_OPERACIONAIS', true),
  ('4.2', 'Aluguel e ocupação', 'DESPESA', 'DESPESAS_OPERACIONAIS', true),
  ('4.3', 'Marketing', 'DESPESA', 'DESPESAS_OPERACIONAIS', true),
  ('4.4', 'Administrativas', 'DESPESA', 'DESPESAS_OPERACIONAIS', true),
  ('5', 'Despesas financeiras', 'DESPESA', 'DESPESAS_FINANCEIRAS', false),
  ('5.1', 'Tarifas e juros', 'DESPESA', 'DESPESAS_FINANCEIRAS', true),
  ('6', 'Impostos sobre o lucro', 'DESPESA', 'IMPOSTOS_SOBRE_LUCRO', true);
update public.plano_contas f set pai_id = p.id
  from public.plano_contas p
 where position('.' in f.codigo) > 0 and p.codigo = split_part(f.codigo, '.', 1);

create table public.cartoes_corporativos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 2 and 60),
  bandeira text check (char_length(bandeira) <= 30),
  final text check (final ~ '^[0-9]{4}$'),
  limite numeric(14,2) check (limite >= 0),
  dia_fechamento integer not null check (dia_fechamento between 1 and 28),
  dia_vencimento integer not null check (dia_vencimento between 1 and 28),
  responsavel_id uuid references public.perfis(id) on delete set null,
  conta_bancaria_id uuid references public.contas_bancarias(id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.recorrencias_financeiras (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('PAGAR','RECEBER')),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 150),
  pessoa text not null check (char_length(btrim(pessoa)) between 1 and 150),
  valor numeric(14,2) not null check (valor > 0),
  frequencia text not null default 'MENSAL' check (frequencia in ('SEMANAL','QUINZENAL','MENSAL','BIMESTRAL','TRIMESTRAL','SEMESTRAL','ANUAL')),
  inicio date not null,
  fim date,
  proxima_geracao date not null,
  antecedencia_dias integer not null default 10 check (antecedencia_dias between 0 and 90),
  forma_pagamento text not null check (forma_pagamento in ('PIX','BOLETO','TRANSFERENCIA','CARTAO','DINHEIRO')),
  chave_pix text check (char_length(chave_pix) <= 140),
  categoria text check (char_length(categoria) <= 60),
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  centro_custo_id uuid references public.centros_custo(id) on delete set null,
  plano_conta_id uuid references public.plano_contas(id) on delete set null,
  conta_bancaria_id uuid references public.contas_bancarias(id) on delete set null,
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio),
  check (forma_pagamento <> 'PIX' or nullif(btrim(chave_pix), '') is not null)
);
create trigger recorrencias_atualizado_em before update on public.recorrencias_financeiras
  for each row execute function public.tocar_atualizado_em();

do $$
declare t text;
begin
  foreach t in array array['contas_pagar','contas_receber'] loop
    execute format('alter table public.%I
      add column competencia date,
      add column conta_bancaria_id uuid references public.contas_bancarias(id) on delete set null,
      add column plano_conta_id uuid references public.plano_contas(id) on delete set null,
      add column recorrencia_id uuid references public.recorrencias_financeiras(id) on delete set null,
      add column parcelamento_id uuid,
      add column parcela_numero integer check (parcela_numero > 0),
      add column parcela_total integer check (parcela_total > 0),
      add column juros numeric(14,2) not null default 0 check (juros >= 0),
      add column multa numeric(14,2) not null default 0 check (multa >= 0),
      add column desconto numeric(14,2) not null default 0 check (desconto >= 0),
      add column valor_pago numeric(14,2) check (valor_pago >= 0),
      add column extras jsonb not null default ''{}''::jsonb check (jsonb_typeof(extras) = ''object'')', t);
    execute format('create index %I on public.%I (parcelamento_id) where parcelamento_id is not null', t || '_parcelamento', t);
    execute format('create index %I on public.%I (coalesce(competencia, vencimento))', t || '_competencia', t);
  end loop;
end $$;

create table public.faturas_cartao_corporativo (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid not null references public.cartoes_corporativos(id) on delete cascade,
  competencia date not null check (extract(day from competencia) = 1),
  fechamento date not null,
  vencimento date not null,
  valor_total numeric(14,2) not null default 0,
  status text not null default 'ABERTA' check (status in ('ABERTA','FECHADA','PAGA')),
  conta_pagar_id uuid references public.contas_pagar(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (cartao_id, competencia)
);

create table public.gastos_cartao (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid not null references public.cartoes_corporativos(id) on delete cascade,
  fatura_id uuid references public.faturas_cartao_corporativo(id) on delete set null,
  data date not null,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 150),
  valor numeric(14,2) not null check (valor > 0),
  plano_conta_id uuid references public.plano_contas(id) on delete set null,
  centro_custo_id uuid references public.centros_custo(id) on delete set null,
  portador_id uuid references public.perfis(id) on delete set null,
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index gastos_cartao_fatura on public.gastos_cartao(fatura_id);

create table public.lancamentos_caixa (
  id uuid primary key default gen_random_uuid(),
  conta_bancaria_id uuid not null references public.contas_bancarias(id) on delete restrict,
  data date not null,
  tipo text not null check (tipo in ('ENTRADA','SAIDA')),
  valor numeric(14,2) not null check (valor > 0),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 150),
  plano_conta_id uuid references public.plano_contas(id) on delete set null,
  origem text not null default 'MANUAL' check (origem in ('MANUAL','CONTA_PAGAR','CONTA_RECEBER','TRANSFERENCIA')),
  origem_id uuid,
  transferencia_id uuid,
  conciliado boolean not null default false,
  conciliado_em timestamptz,
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index lancamentos_caixa_conta_data on public.lancamentos_caixa (conta_bancaria_id, data);
create index lancamentos_caixa_origem on public.lancamentos_caixa (origem, origem_id);

create table public.rateios_lancamento (
  id uuid primary key default gen_random_uuid(),
  tipo_conta text not null check (tipo_conta in ('PAGAR','RECEBER')),
  conta_id uuid not null,
  centro_custo_id uuid references public.centros_custo(id) on delete restrict,
  plano_conta_id uuid references public.plano_contas(id) on delete restrict,
  percentual numeric(5,2) not null check (percentual > 0 and percentual <= 100),
  criado_em timestamptz not null default now(),
  check (centro_custo_id is not null or plano_conta_id is not null)
);
create index rateios_lancamento_conta on public.rateios_lancamento (tipo_conta, conta_id);

create or replace function public.validar_rateio()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select coalesce(sum(percentual), 0) from public.rateios_lancamento
       where tipo_conta = new.tipo_conta and conta_id = new.conta_id) > 100 then
    raise exception using errcode = 'P0001', message = 'rateio_acima_de_100';
  end if;
  return null;
end;
$$;
create trigger rateios_validar after insert or update on public.rateios_lancamento
  for each row execute function public.validar_rateio();

create table public.creditos_cliente (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  saldo numeric(14,2) not null default 0 check (saldo >= 0),
  atualizado_em timestamptz not null default now()
);
create table public.creditos_cliente_movimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('CREDITO','DEBITO')),
  valor numeric(14,2) not null check (valor > 0),
  motivo text not null check (char_length(btrim(motivo)) between 2 and 200),
  validade date,
  entidade text check (entidade ~ '^[a-z_]{2,40}$'),
  registro_id uuid,
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index creditos_movimentos_cliente on public.creditos_cliente_movimentos (cliente_id, criado_em desc);

create or replace function public.atualizar_saldo_credito()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.creditos_cliente (cliente_id, saldo)
  values (new.cliente_id, case new.tipo when 'CREDITO' then new.valor else -new.valor end)
  on conflict (cliente_id) do update
    set saldo = public.creditos_cliente.saldo + excluded.saldo, atualizado_em = now();
  return null;
exception when check_violation then
  raise exception using errcode = 'P0001', message = 'credito_insuficiente';
end;
$$;
revoke execute on function public.atualizar_saldo_credito() from public, anon, authenticated;
create trigger creditos_movimentos_saldo after insert on public.creditos_cliente_movimentos
  for each row execute function public.atualizar_saldo_credito();

create table public.cotacoes_moeda (
  id uuid primary key default gen_random_uuid(),
  moeda text not null check (moeda ~ '^[A-Z]{3}$' and moeda <> 'BRL'),
  data date not null,
  valor numeric(14,6) not null check (valor > 0),
  fonte text check (char_length(fonte) <= 60),
  criado_em timestamptz not null default now(),
  unique (moeda, data)
);

-- Baixa de conta gera (ou remove) o lancamento no caixa
create or replace function public.conta_no_caixa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pagar boolean := tg_table_name = 'contas_pagar';
  v_origem text := case when tg_table_name = 'contas_pagar' then 'CONTA_PAGAR' else 'CONTA_RECEBER' end;
  v_quitado text := case when tg_table_name = 'contas_pagar' then 'PAGO' else 'RECEBIDO' end;
  v_tipo text := case when tg_table_name = 'contas_pagar' then 'SAIDA' else 'ENTRADA' end;
  v_status_fatura text;
  v jsonb;
begin
  delete from public.lancamentos_caixa where origem = v_origem and origem_id = coalesce(new.id, old.id);
  if tg_op = 'DELETE' then
    return null;
  end if;
  v := to_jsonb(new);
  if new.status = v_quitado and new.conta_bancaria_id is not null then
    insert into public.lancamentos_caixa (conta_bancaria_id, data, tipo, valor, descricao, plano_conta_id, origem, origem_id, criado_por)
    values (new.conta_bancaria_id,
            coalesce(v ->> 'data_pagamento', v ->> 'data_recebimento')::date,
            v_tipo,
            coalesce(new.valor_pago, new.valor_liquido + new.juros + new.multa - new.desconto),
            new.descricao, new.plano_conta_id, v_origem, new.id, (select auth.uid()));
  end if;
  if v_pagar then
    v_status_fatura := case when new.status = 'PAGO' then 'PAGA' else 'FECHADA' end;
    update public.faturas_cartao_corporativo
       set status = v_status_fatura
     where conta_pagar_id = new.id and status <> 'ABERTA';
  end if;
  return null;
end;
$$;
revoke execute on function public.conta_no_caixa() from public, anon, authenticated;
create trigger contas_pagar_caixa after insert or delete or update of status, data_pagamento, conta_bancaria_id, valor_pago, juros, multa, desconto
  on public.contas_pagar for each row execute function public.conta_no_caixa();
create trigger contas_receber_caixa after insert or delete or update of status, data_recebimento, conta_bancaria_id, valor_pago, juros, multa, desconto
  on public.contas_receber for each row execute function public.conta_no_caixa();

create view public.saldos_contas_bancarias with (security_invoker = true) as
select b.id, b.nome, b.tipo, b.moeda, b.ativo, b.saldo_inicial,
       coalesce(sum(l.valor) filter (where l.tipo = 'ENTRADA'), 0) as entradas,
       coalesce(sum(l.valor) filter (where l.tipo = 'SAIDA'), 0) as saidas,
       b.saldo_inicial + coalesce(sum(case l.tipo when 'ENTRADA' then l.valor else -l.valor end), 0) as saldo_atual,
       b.saldo_inicial + coalesce(sum(case l.tipo when 'ENTRADA' then l.valor else -l.valor end) filter (where l.conciliado), 0) as saldo_conciliado
  from public.contas_bancarias b
  left join public.lancamentos_caixa l on l.conta_bancaria_id = b.id and l.data >= b.data_saldo_inicial
 group by b.id;

create or replace function public.transferir_entre_contas(p_origem uuid, p_destino uuid, p_valor numeric, p_data date, p_descricao text default null)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_desc text := coalesce(nullif(btrim(p_descricao), ''), 'Transferência entre contas');
begin
  if p_origem = p_destino then
    raise exception using errcode = 'P0001', message = 'transferencia_mesma_conta';
  end if;
  insert into public.lancamentos_caixa (conta_bancaria_id, data, tipo, valor, descricao, origem, transferencia_id)
  values (p_origem, p_data, 'SAIDA', p_valor, v_desc, 'TRANSFERENCIA', v_id),
         (p_destino, p_data, 'ENTRADA', p_valor, v_desc, 'TRANSFERENCIA', v_id);
  return v_id;
end;
$$;

create or replace function public.parcelar_conta(p_tipo text, p_id uuid, p_parcelas integer)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_tab text := case p_tipo when 'PAGAR' then 'contas_pagar' when 'RECEBER' then 'contas_receber' end;
  v_valor numeric;
  v_venc date;
  v_comp date;
  v_grupo uuid;
  v_status text;
  v_base numeric;
  v_valor_i numeric;
  v_cols text;
  v_novo uuid := gen_random_uuid();
  i integer;
begin
  if v_tab is null then
    raise exception using errcode = '22023', message = 'tipo_invalido';
  end if;
  if p_parcelas is null or p_parcelas < 2 or p_parcelas > 120 then
    raise exception using errcode = '22023', message = 'parcelas_invalidas';
  end if;
  execute format('select valor, vencimento, competencia, parcelamento_id, status from public.%I where id = $1 for update', v_tab)
     into v_valor, v_venc, v_comp, v_grupo, v_status using p_id;
  if v_valor is null then
    raise exception using errcode = 'P0002', message = 'conta_nao_encontrada';
  end if;
  if v_grupo is not null then
    raise exception using errcode = 'P0001', message = 'conta_ja_parcelada';
  end if;
  if v_status <> 'PENDENTE' then
    raise exception using errcode = 'P0001', message = 'conta_nao_pendente';
  end if;
  v_base := trunc(v_valor / p_parcelas, 2);
  select string_agg(quote_ident(column_name), ', ') into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = v_tab and is_generated = 'NEVER'
     and column_name not in ('id','valor','vencimento','competencia','parcela_numero','parcela_total',
                             'parcelamento_id','criado_em','atualizado_em');
  for i in 2..p_parcelas loop
    v_valor_i := v_base;
    if i = p_parcelas then
      v_valor_i := v_valor - v_base * (p_parcelas - 1);
    end if;
    execute format('insert into public.%I (%s, valor, vencimento, competencia, parcela_numero, parcela_total, parcelamento_id) select %s, $2, $3, $4, $5, $6, $7 from public.%I where id = $1',
                   v_tab, v_cols, v_cols, v_tab)
      using p_id, v_valor_i, (v_venc + make_interval(months => i - 1))::date,
            (v_comp + make_interval(months => i - 1))::date, i, p_parcelas, v_novo;
  end loop;
  execute format('update public.%I set valor = $2, parcela_numero = 1, parcela_total = $3, parcelamento_id = $4 where id = $1', v_tab)
    using p_id, v_base, p_parcelas, v_novo;
  return v_novo;
end;
$$;

create or replace function public.proxima_data_recorrencia(p_data date, p_frequencia text)
returns date language sql immutable set search_path = '' as $$
  select (p_data + case p_frequencia
    when 'SEMANAL' then interval '7 days'
    when 'QUINZENAL' then interval '14 days'
    when 'MENSAL' then interval '1 month'
    when 'BIMESTRAL' then interval '2 months'
    when 'TRIMESTRAL' then interval '3 months'
    when 'SEMESTRAL' then interval '6 months'
    else interval '1 year' end)::date
$$;

create or replace function public.processar_recorrencia(p_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.recorrencias_financeiras;
  v_qtd integer := 0;
begin
  select * into r from public.recorrencias_financeiras where id = p_id and ativo for update;
  if not found then
    return 0;
  end if;
  while r.proxima_geracao <= current_date + r.antecedencia_dias
        and (r.fim is null or r.proxima_geracao <= r.fim) and v_qtd < 24 loop
    if r.tipo = 'PAGAR' then
      insert into public.contas_pagar (descricao, favorecido, categoria, valor, vencimento, competencia, forma_pagamento, chave_pix,
                                       fornecedor_id, centro_custo_id, plano_conta_id, conta_bancaria_id, recorrencia_id, criado_por)
      values (r.descricao, r.pessoa, r.categoria, r.valor, r.proxima_geracao, date_trunc('month', r.proxima_geracao)::date,
              r.forma_pagamento, r.chave_pix, r.fornecedor_id, r.centro_custo_id, r.plano_conta_id, r.conta_bancaria_id, r.id, r.criado_por);
    else
      insert into public.contas_receber (descricao, pagador, categoria, valor, vencimento, competencia, forma_pagamento, chave_pix,
                                         cliente_id, centro_custo_id, plano_conta_id, conta_bancaria_id, recorrencia_id, criado_por)
      values (r.descricao, r.pessoa, r.categoria, r.valor, r.proxima_geracao, date_trunc('month', r.proxima_geracao)::date,
              r.forma_pagamento, r.chave_pix, r.cliente_id, r.centro_custo_id, r.plano_conta_id, r.conta_bancaria_id, r.id, r.criado_por);
    end if;
    r.proxima_geracao := public.proxima_data_recorrencia(r.proxima_geracao, r.frequencia);
    v_qtd := v_qtd + 1;
  end loop;
  if v_qtd > 0 then
    update public.recorrencias_financeiras set proxima_geracao = r.proxima_geracao where id = p_id;
  end if;
  return v_qtd;
end;
$$;
revoke execute on function public.processar_recorrencia(uuid) from public, anon, authenticated;

create or replace function public.gerar_recorrencias()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_total integer := 0;
  v_id uuid;
begin
  for v_id in select id from public.recorrencias_financeiras
               where ativo and proxima_geracao <= current_date + antecedencia_dias loop
    v_total := v_total + public.processar_recorrencia(v_id);
  end loop;
  return v_total;
end;
$$;
revoke execute on function public.gerar_recorrencias() from public, anon, authenticated;

create or replace function public.recorrencia_salva()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 then
    perform public.processar_recorrencia(new.id);
  end if;
  return null;
end;
$$;
revoke execute on function public.recorrencia_salva() from public, anon, authenticated;
create trigger recorrencias_gerar after insert or update of ativo, proxima_geracao, antecedencia_dias on public.recorrencias_financeiras
  for each row when (new.ativo) execute function public.recorrencia_salva();

select cron.schedule('gerar-recorrencias', '0 8 * * *', $$select public.gerar_recorrencias()$$);

create or replace function public.gasto_na_fatura()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.cartoes_corporativos;
  v_comp date;
  v_fatura uuid;
  v_status text;
  v_venc date;
begin
  select * into c from public.cartoes_corporativos where id = new.cartao_id;
  v_comp := date_trunc('month', new.data)::date;
  if extract(day from new.data) > c.dia_fechamento then
    v_comp := (v_comp + interval '1 month')::date;
  end if;
  loop
    select id, status into v_fatura, v_status from public.faturas_cartao_corporativo
     where cartao_id = c.id and competencia = v_comp;
    exit when v_fatura is null or v_status = 'ABERTA';
    v_comp := (v_comp + interval '1 month')::date;
  end loop;
  if v_fatura is null then
    v_venc := v_comp + (c.dia_vencimento - 1);
    if c.dia_vencimento <= c.dia_fechamento then
      v_venc := (v_venc + interval '1 month')::date;
    end if;
    insert into public.faturas_cartao_corporativo (cartao_id, competencia, fechamento, vencimento)
    values (c.id, v_comp, v_comp + (c.dia_fechamento - 1), v_venc)
    returning id into v_fatura;
  end if;
  new.fatura_id := v_fatura;
  return new;
end;
$$;
revoke execute on function public.gasto_na_fatura() from public, anon, authenticated;
create trigger gastos_cartao_fatura before insert on public.gastos_cartao
  for each row when (new.fatura_id is null) execute function public.gasto_na_fatura();

create or replace function public.somar_fatura()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.faturas_cartao_corporativo f
     set valor_total = coalesce((select sum(g.valor) from public.gastos_cartao g where g.fatura_id = f.id), 0)
   where f.id = new.fatura_id or f.id = old.fatura_id;
  return null;
end;
$$;
revoke execute on function public.somar_fatura() from public, anon, authenticated;
create trigger gastos_cartao_somar after insert or update or delete on public.gastos_cartao
  for each row execute function public.somar_fatura();

create or replace function public.bloquear_gasto_em_fatura_fechada()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.faturas_cartao_corporativo
              where id = coalesce(old.fatura_id, new.fatura_id) and status <> 'ABERTA') then
    raise exception using errcode = 'P0001', message = 'fatura_fechada';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger gastos_cartao_fechada before update or delete on public.gastos_cartao
  for each row execute function public.bloquear_gasto_em_fatura_fechada();

create or replace function public.fechar_fatura(p_fatura_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  f public.faturas_cartao_corporativo;
  c public.cartoes_corporativos;
  v_conta uuid;
begin
  if not public.pode_acessar('financeiro/cartoes') then
    raise exception using errcode = '42501', message = 'sem_permissao';
  end if;
  select * into f from public.faturas_cartao_corporativo where id = p_fatura_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'fatura_nao_encontrada';
  end if;
  if f.status <> 'ABERTA' then
    raise exception using errcode = 'P0001', message = 'fatura_ja_fechada';
  end if;
  if f.valor_total <= 0 then
    raise exception using errcode = 'P0001', message = 'fatura_sem_gastos';
  end if;
  select * into c from public.cartoes_corporativos where id = f.cartao_id;
  insert into public.contas_pagar (descricao, favorecido, categoria, valor, vencimento, competencia, forma_pagamento, conta_bancaria_id, criado_por)
  values (left('Fatura ' || c.nome || ' ' || to_char(f.competencia, 'MM/YYYY'), 150), c.nome, 'Cartão corporativo',
          f.valor_total, f.vencimento, f.competencia, 'BOLETO', c.conta_bancaria_id, (select auth.uid()))
  returning id into v_conta;
  update public.faturas_cartao_corporativo set status = 'FECHADA', conta_pagar_id = v_conta where id = p_fatura_id;
  return v_conta;
end;
$$;

create or replace function public.relatorio_dre(p_inicio date, p_fim date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g jsonb;
  v_rb numeric; v_ded numeric; v_cus numeric; v_dop numeric; v_rf numeric; v_df numeric; v_ir numeric;
  v_rl numeric; v_lb numeric; v_ro numeric; v_res numeric; v_margem numeric := 0;
  v_despesas jsonb;
  v_detalhe jsonb;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Informe um período válido: a data final deve ser igual ou posterior à inicial';
  end if;
  if p_fim - p_inicio > 1096 then
    raise exception 'O período pode ter no máximo 3 anos';
  end if;

  with base as (
    select coalesce(p.grupo_dre, 'RECEITA_BRUTA') grupo, coalesce(p.codigo || ' ' || p.nome, 'Receitas sem classificação') conta, c.valor
      from public.contas_receber c left join public.plano_contas p on p.id = c.plano_conta_id
     where c.status <> 'CANCELADO' and coalesce(c.competencia, c.vencimento) between p_inicio and p_fim
    union all
    select 'DEDUCOES', 'Impostos destacados nas receitas', c.valor_imposto
      from public.contas_receber c
     where c.status <> 'CANCELADO' and c.valor_imposto > 0 and coalesce(c.competencia, c.vencimento) between p_inicio and p_fim
    union all
    select coalesce(p.grupo_dre, 'DESPESAS_OPERACIONAIS'), coalesce(p.codigo || ' ' || p.nome, 'Despesas sem classificação'),
           c.valor + c.juros + c.multa - c.desconto
      from public.contas_pagar c left join public.plano_contas p on p.id = c.plano_conta_id
     where c.status <> 'CANCELADO' and coalesce(c.competencia, c.vencimento) between p_inicio and p_fim
       and not exists (select 1 from public.faturas_cartao_corporativo f where f.conta_pagar_id = c.id)
    union all
    select coalesce(p.grupo_dre, 'DESPESAS_OPERACIONAIS'), coalesce(p.codigo || ' ' || p.nome, 'Cartão sem classificação'), gc.valor
      from public.gastos_cartao gc left join public.plano_contas p on p.id = gc.plano_conta_id
     where gc.data between p_inicio and p_fim
  ), por_grupo as (
    select grupo, sum(valor) total from base group by grupo
  ), por_conta as (
    select grupo, conta, sum(valor) total from base group by grupo, conta
  )
  select (select coalesce(jsonb_object_agg(grupo, total), '{}'::jsonb) from por_grupo),
         (select coalesce(jsonb_agg(jsonb_build_object('rotulo', conta, 'valor', total) order by total desc), '[]'::jsonb)
            from (select conta, total from por_conta
                   where grupo in ('CUSTOS','DESPESAS_OPERACIONAIS','DESPESAS_FINANCEIRAS')
                   order by total desc limit 12) x),
         (select coalesce(jsonb_agg(jsonb_build_object('conta', conta, 'valor', total) order by conta), '[]'::jsonb) from por_conta)
    into g, v_despesas, v_detalhe;

  v_rb := coalesce((g ->> 'RECEITA_BRUTA')::numeric, 0);
  v_ded := coalesce((g ->> 'DEDUCOES')::numeric, 0);
  v_cus := coalesce((g ->> 'CUSTOS')::numeric, 0);
  v_dop := coalesce((g ->> 'DESPESAS_OPERACIONAIS')::numeric, 0);
  v_rf := coalesce((g ->> 'RECEITAS_FINANCEIRAS')::numeric, 0);
  v_df := coalesce((g ->> 'DESPESAS_FINANCEIRAS')::numeric, 0);
  v_ir := coalesce((g ->> 'IMPOSTOS_SOBRE_LUCRO')::numeric, 0);
  v_rl := v_rb - v_ded;
  v_lb := v_rl - v_cus;
  v_ro := v_lb - v_dop;
  v_res := v_ro + v_rf - v_df - v_ir;
  if v_rl <> 0 then
    v_margem := round(v_res * 100 / v_rl, 1);
  end if;

  return jsonb_build_object(
    'indicadores', jsonb_build_array(
      jsonb_build_object('rotulo', 'Receita líquida', 'valor', v_rl, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Lucro bruto', 'valor', v_lb, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Resultado operacional', 'valor', v_ro, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Resultado líquido', 'valor', v_res, 'formato', 'moeda'),
      jsonb_build_object('rotulo', 'Margem líquida (%)', 'valor', v_margem, 'formato', 'numero')
    ),
    'graficos', jsonb_build_array(
      jsonb_build_object('titulo', 'Despesas por conta do plano', 'formato', 'moeda', 'itens', v_despesas)
    ),
    'tabelas', jsonb_build_array(
      jsonb_build_object('titulo', 'Demonstrativo do resultado',
        'colunas', jsonb_build_array(
          jsonb_build_object('chave', 'linha', 'rotulo', 'Linha', 'formato', 'texto'),
          jsonb_build_object('chave', 'valor', 'rotulo', 'Valor', 'formato', 'moeda')),
        'linhas', jsonb_build_array(
          jsonb_build_object('linha', 'Receita bruta', 'valor', v_rb),
          jsonb_build_object('linha', '(-) Deduções', 'valor', -v_ded),
          jsonb_build_object('linha', '= Receita líquida', 'valor', v_rl),
          jsonb_build_object('linha', '(-) Custos', 'valor', -v_cus),
          jsonb_build_object('linha', '= Lucro bruto', 'valor', v_lb),
          jsonb_build_object('linha', '(-) Despesas operacionais', 'valor', -v_dop),
          jsonb_build_object('linha', '= Resultado operacional', 'valor', v_ro),
          jsonb_build_object('linha', '(+) Receitas financeiras', 'valor', v_rf),
          jsonb_build_object('linha', '(-) Despesas financeiras', 'valor', -v_df),
          jsonb_build_object('linha', '(-) Impostos sobre o lucro', 'valor', -v_ir),
          jsonb_build_object('linha', '= Resultado líquido', 'valor', v_res))),
      jsonb_build_object('titulo', 'Detalhe por conta',
        'colunas', jsonb_build_array(
          jsonb_build_object('chave', 'conta', 'rotulo', 'Conta', 'formato', 'texto'),
          jsonb_build_object('chave', 'valor', 'rotulo', 'Valor', 'formato', 'moeda')),
        'linhas', v_detalhe)
    ));
end;
$$;
revoke execute on function public.relatorio_dre(date, date) from public, anon, authenticated;

create or replace function public.projecao_caixa(p_inicio date, p_fim date)
returns table (dia date, entradas_realizadas numeric, saidas_realizadas numeric,
               entradas_previstas numeric, saidas_previstas numeric, saldo_acumulado numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_saldo numeric;
begin
  if not public.pode_acessar('financeiro/fluxo-caixa') then
    raise exception using errcode = '42501', message = 'sem_permissao';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 400 then
    raise exception using errcode = '22023', message = 'periodo_invalido';
  end if;
  select coalesce(sum(b.saldo_inicial), 0)
       + coalesce((select sum(case l.tipo when 'ENTRADA' then l.valor else -l.valor end)
                     from public.lancamentos_caixa l join public.contas_bancarias cb on cb.id = l.conta_bancaria_id
                    where cb.ativo and l.data >= cb.data_saldo_inicial and l.data < p_inicio), 0)
    into v_saldo from public.contas_bancarias b where b.ativo;
  return query
  with dias as (select d::date dia from generate_series(p_inicio, p_fim, interval '1 day') d),
  mov as (
    select d.dia,
      coalesce((select sum(l.valor) from public.lancamentos_caixa l where l.data = d.dia and l.tipo = 'ENTRADA'), 0) er,
      coalesce((select sum(l.valor) from public.lancamentos_caixa l where l.data = d.dia and l.tipo = 'SAIDA'), 0) sr,
      coalesce((select sum(c.valor_liquido) from public.contas_receber c where c.status = 'PENDENTE' and c.vencimento = d.dia), 0) ep,
      coalesce((select sum(c.valor_liquido) from public.contas_pagar c where c.status = 'PENDENTE' and c.vencimento = d.dia), 0) sp
    from dias d)
  select m.dia, m.er, m.sr, m.ep, m.sp,
         v_saldo + sum(m.er - m.sr + m.ep - m.sp) over (order by m.dia)
    from mov m order by m.dia;
end;
$$;

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
    else null end;
end;
$$;

do $$
declare r record;
begin
  for r in select * from (values
    ('contas_bancarias', 'financeiro', 'financeiro/contas-bancarias'),
    ('plano_contas', 'financeiro', 'financeiro/plano-contas'),
    ('cartoes_corporativos', 'financeiro/cartoes', 'financeiro/cartoes'),
    ('faturas_cartao_corporativo', 'financeiro/cartoes', 'financeiro/cartoes'),
    ('gastos_cartao', 'financeiro/cartoes', 'financeiro/cartoes'),
    ('cotacoes_moeda', 'financeiro', 'financeiro/cotacoes'),
    ('creditos_cliente_movimentos', 'financeiro/creditos', 'financeiro/creditos')
  ) v(tabela, ler, gravar) loop
    execute format('alter table public.%I enable row level security', r.tabela);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.pode_acessar(%L)))', r.tabela || '_ler', r.tabela, r.ler);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.pode_acessar(%L)))', r.tabela || '_incluir', r.tabela, r.gravar);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.pode_acessar(%L))) with check ((select public.pode_acessar(%L)))', r.tabela || '_alterar', r.tabela, r.gravar, r.gravar);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.pode_acessar(%L)))', r.tabela || '_excluir', r.tabela, r.gravar);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.tabela);
  end loop;
end $$;
revoke update, delete on public.creditos_cliente_movimentos from authenticated;
revoke insert on public.faturas_cartao_corporativo from authenticated;

alter table public.creditos_cliente enable row level security;
create policy creditos_cliente_ler on public.creditos_cliente for select to authenticated
  using ((select public.pode_acessar('financeiro')) or (select public.pode_acessar('crm/clientes')));
grant select on public.creditos_cliente to authenticated;

alter table public.lancamentos_caixa enable row level security;
create policy lancamentos_ler on public.lancamentos_caixa for select to authenticated
  using ((select public.pode_acessar('financeiro/fluxo-caixa')) or (select public.pode_acessar('financeiro/contas-bancarias')));
create policy lancamentos_incluir on public.lancamentos_caixa for insert to authenticated
  with check ((select public.pode_acessar('financeiro/fluxo-caixa')) and origem in ('MANUAL','TRANSFERENCIA'));
create policy lancamentos_alterar on public.lancamentos_caixa for update to authenticated
  using ((select public.pode_acessar('financeiro/fluxo-caixa'))) with check ((select public.pode_acessar('financeiro/fluxo-caixa')));
create policy lancamentos_excluir on public.lancamentos_caixa for delete to authenticated
  using ((select public.pode_acessar('financeiro/fluxo-caixa')) and origem in ('MANUAL','TRANSFERENCIA'));
grant select, insert, delete on public.lancamentos_caixa to authenticated;
grant update (conciliado, conciliado_em, descricao, plano_conta_id) on public.lancamentos_caixa to authenticated;

alter table public.rateios_lancamento enable row level security;
create policy rateios_acesso on public.rateios_lancamento for all to authenticated
  using (public.pode_acessar(case tipo_conta when 'PAGAR' then 'financeiro/contas-pagar' else 'financeiro/contas-receber' end))
  with check (public.pode_acessar(case tipo_conta when 'PAGAR' then 'financeiro/contas-pagar' else 'financeiro/contas-receber' end));
grant select, insert, update, delete on public.rateios_lancamento to authenticated;

alter table public.recorrencias_financeiras enable row level security;
create policy recorrencias_acesso on public.recorrencias_financeiras for all to authenticated
  using (public.pode_acessar(case tipo when 'PAGAR' then 'financeiro/contas-pagar' else 'financeiro/contas-receber' end))
  with check (public.pode_acessar(case tipo when 'PAGAR' then 'financeiro/contas-pagar' else 'financeiro/contas-receber' end));
grant select, insert, update, delete on public.recorrencias_financeiras to authenticated;

grant select on public.saldos_contas_bancarias to authenticated;
grant execute on function public.transferir_entre_contas(uuid, uuid, numeric, date, text),
  public.parcelar_conta(text, uuid, integer), public.fechar_fatura(uuid),
  public.projecao_caixa(date, date), public.proxima_data_recorrencia(date, text)
to authenticated;

do $$
declare t text;
begin
  foreach t in array array['contas_bancarias','plano_contas','cartoes_corporativos','gastos_cartao','lancamentos_caixa',
                           'recorrencias_financeiras','creditos_cliente_movimentos'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t || '_auditoria', t);
  end loop;
end $$;
