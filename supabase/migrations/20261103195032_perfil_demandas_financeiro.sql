-- perfil_demandas_financeiro
alter table public.perfis
  add column if not exists telefone text check (char_length(telefone) <= 20),
  add column if not exists funcao text check (char_length(funcao) <= 80),
  add column if not exists bio text check (char_length(bio) <= 500),
  add column if not exists avatar_url text check (char_length(avatar_url) <= 500);

alter table public.perfis drop constraint if exists perfis_acessos_validos;
alter table public.perfis
  add constraint perfis_acessos_validos check (
    jsonb_typeof(acessos) = 'array'
    and acessos <@ '["*","dashboard","produtos","demandas","financeiro","usuarios"]'::jsonb
    and (papel = 'ADMIN' or not acessos ? 'usuarios')
  );
alter table public.perfis alter column acessos set default '["dashboard","produtos","demandas"]'::jsonb;

update public.perfis
   set acessos = acessos || '["demandas"]'::jsonb
 where papel <> 'ADMIN' and not acessos ? '*' and not acessos ? 'demandas';

create or replace function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ), 100),
    new.email
  );
  return new;
end;
$$;
revoke execute on function public.criar_perfil_do_usuario() from public, anon, authenticated;

create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.tocar_atualizado_em() from public, anon, authenticated;

create table public.demandas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 150),
  descricao text check (char_length(descricao) <= 5000),
  status text not null default 'A_FAZER'
    check (status in ('A_FAZER', 'EM_ANDAMENTO', 'EM_REVISAO', 'CONCLUIDO')),
  urgencia text not null default 'MEDIA' check (urgencia in ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE')),
  tipo text not null default 'TAREFA' check (tipo in ('TAREFA', 'BUG', 'MELHORIA', 'SOLICITACAO')),
  prazo date,
  responsaveis uuid[] not null default '{}',
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  ordem integer not null default 0,
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.demandas is 'Demandas do Kanban. Acessada somente pelo backend com a chave secreta.';
create index demandas_responsaveis_idx on public.demandas using gin (responsaveis);
create index demandas_status_ordem_idx on public.demandas (status, ordem);
create index demandas_criado_por_idx on public.demandas (criado_por);
alter table public.demandas enable row level security;
revoke all on table public.demandas from anon, authenticated;

create trigger demandas_atualizado_em
  before update on public.demandas
  for each row execute function public.tocar_atualizado_em();

create or replace function public.demanda_no_fim_da_coluna()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ordem := coalesce((select max(ordem) + 1 from public.demandas where status = new.status), 0);
  return new;
end;
$$;
revoke execute on function public.demanda_no_fim_da_coluna() from public, anon, authenticated;

create trigger demandas_no_fim
  before insert on public.demandas
  for each row execute function public.demanda_no_fim_da_coluna();

create or replace function public.mover_demanda(p_id uuid, p_status text, p_posicao integer)
returns setof public.demandas
language plpgsql
set search_path = ''
as $$
begin
  update public.demandas d
     set ordem = case when o.pos >= p_posicao then o.pos + 1 else o.pos end
    from (select id, (row_number() over (order by ordem, criado_em) - 1)::integer as pos
            from public.demandas
           where status = p_status and id <> p_id) o
   where d.id = o.id and d.ordem is distinct from (case when o.pos >= p_posicao then o.pos + 1 else o.pos end);

  return query
    update public.demandas
       set status = p_status, ordem = greatest(p_posicao, 0)
     where id = p_id
    returning *;
end;
$$;
revoke execute on function public.mover_demanda(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.mover_demanda(uuid, text, integer) to service_role;

create table public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  descricao text not null check (char_length(descricao) between 1 and 150),
  favorecido text not null check (char_length(favorecido) between 1 and 150),
  documento text check (char_length(documento) <= 30),
  categoria text check (char_length(categoria) <= 60),
  valor numeric(14, 2) not null check (valor > 0),
  percentual_imposto numeric(5, 2) not null default 0 check (percentual_imposto between 0 and 100),
  valor_imposto numeric(14, 2) generated always as (round(valor * percentual_imposto / 100, 2)) stored,
  valor_liquido numeric(14, 2) generated always as (valor - round(valor * percentual_imposto / 100, 2)) stored,
  vencimento date not null,
  data_pagamento date,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'PAGO', 'CANCELADO')),
  forma_pagamento text not null
    check (forma_pagamento in ('PIX', 'BOLETO', 'TRANSFERENCIA', 'CARTAO', 'DINHEIRO')),
  chave_pix text check (char_length(chave_pix) <= 140),
  observacoes text check (char_length(observacoes) <= 1000),
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint contas_pagar_pix check (forma_pagamento <> 'PIX' or nullif(trim(chave_pix), '') is not null),
  constraint contas_pagar_baixa check ((status = 'PAGO') = (data_pagamento is not null))
);

create table public.contas_receber (
  id uuid primary key default gen_random_uuid(),
  descricao text not null check (char_length(descricao) between 1 and 150),
  pagador text not null check (char_length(pagador) between 1 and 150),
  documento text check (char_length(documento) <= 30),
  categoria text check (char_length(categoria) <= 60),
  valor numeric(14, 2) not null check (valor > 0),
  percentual_imposto numeric(5, 2) not null default 0 check (percentual_imposto between 0 and 100),
  valor_imposto numeric(14, 2) generated always as (round(valor * percentual_imposto / 100, 2)) stored,
  valor_liquido numeric(14, 2) generated always as (valor - round(valor * percentual_imposto / 100, 2)) stored,
  vencimento date not null,
  data_recebimento date,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'RECEBIDO', 'CANCELADO')),
  forma_pagamento text not null
    check (forma_pagamento in ('PIX', 'BOLETO', 'TRANSFERENCIA', 'CARTAO', 'DINHEIRO')),
  chave_pix text check (char_length(chave_pix) <= 140),
  observacoes text check (char_length(observacoes) <= 1000),
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint contas_receber_pix check (forma_pagamento <> 'PIX' or nullif(trim(chave_pix), '') is not null),
  constraint contas_receber_baixa check ((status = 'RECEBIDO') = (data_recebimento is not null))
);

comment on table public.contas_pagar is 'Contas a pagar. Acessada somente pelo backend com a chave secreta.';
comment on table public.contas_receber is 'Contas a receber. Acessada somente pelo backend com a chave secreta.';
create index contas_pagar_status_vencimento_idx on public.contas_pagar (status, vencimento);
create index contas_receber_status_vencimento_idx on public.contas_receber (status, vencimento);
create index contas_pagar_criado_por_idx on public.contas_pagar (criado_por);
create index contas_receber_criado_por_idx on public.contas_receber (criado_por);
alter table public.contas_pagar enable row level security;
alter table public.contas_receber enable row level security;
revoke all on table public.contas_pagar from anon, authenticated;
revoke all on table public.contas_receber from anon, authenticated;

create trigger contas_pagar_atualizado_em
  before update on public.contas_pagar
  for each row execute function public.tocar_atualizado_em();
create trigger contas_receber_atualizado_em
  before update on public.contas_receber
  for each row execute function public.tocar_atualizado_em();

create or replace function public.resumo_financeiro(p_hoje date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'aPagar', coalesce((select sum(valor_liquido) from public.contas_pagar where status = 'PENDENTE'), 0),
    'aPagarVencido', coalesce((select sum(valor_liquido) from public.contas_pagar
                                where status = 'PENDENTE' and vencimento < p_hoje), 0),
    'contasAPagarVencidas', (select count(*) from public.contas_pagar where status = 'PENDENTE' and vencimento < p_hoje),
    'aReceber', coalesce((select sum(valor_liquido) from public.contas_receber where status = 'PENDENTE'), 0),
    'aReceberVencido', coalesce((select sum(valor_liquido) from public.contas_receber
                                  where status = 'PENDENTE' and vencimento < p_hoje), 0),
    'contasAReceberVencidas', (select count(*) from public.contas_receber where status = 'PENDENTE' and vencimento < p_hoje),
    'pagoNoMes', coalesce((select sum(valor_liquido) from public.contas_pagar
                            where status = 'PAGO' and date_trunc('month', data_pagamento) = date_trunc('month', p_hoje)), 0),
    'recebidoNoMes', coalesce((select sum(valor_liquido) from public.contas_receber
                                where status = 'RECEBIDO' and date_trunc('month', data_recebimento) = date_trunc('month', p_hoje)), 0)
  );
$$;
revoke execute on function public.resumo_financeiro(date) from public, anon, authenticated;
grant execute on function public.resumo_financeiro(date) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
