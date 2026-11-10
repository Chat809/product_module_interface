-- produtos_e_estoque
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique check (codigo ~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$'),
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  descricao text check (char_length(descricao) <= 500),
  categoria text check (char_length(categoria) between 1 and 60),
  unidade text not null default 'UN' check (unidade in ('UN','PC','CX','KIT','PAR','KG','G','L','ML','M','M2')),
  preco numeric(12,2) not null check (preco > 0),
  custo numeric(12,2) check (custo >= 0),
  quantidade_em_estoque integer not null default 0 check (quantidade_em_estoque >= 0),
  ativo boolean not null default true,
  criado_por uuid references auth.users (id) on delete set null,
  atualizado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao bigint not null default 0
);

comment on table public.produtos is 'Catalogo de produtos e saldo em estoque. Acessada somente pelo backend com a chave secreta.';
create index produtos_nome_idx on public.produtos (lower(nome));
create index produtos_categoria_idx on public.produtos (categoria);

create table public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete cascade,
  tipo text not null check (tipo in ('ENTRADA','SAIDA','AJUSTE')),
  quantidade integer not null check (quantidade > 0),
  saldo_anterior integer not null check (saldo_anterior >= 0),
  saldo_apos integer not null check (saldo_apos >= 0),
  motivo text check (char_length(motivo) <= 200),
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);

comment on table public.movimentacoes_estoque is 'Historico imutavel do estoque de cada produto. Acessada somente pelo backend com a chave secreta.';
create index movimentacoes_estoque_produto_idx on public.movimentacoes_estoque (produto_id, criado_em desc, id);

alter table public.produtos enable row level security;
alter table public.movimentacoes_estoque enable row level security;
revoke all on public.produtos, public.movimentacoes_estoque from anon, authenticated;
grant select, insert, update, delete on public.produtos, public.movimentacoes_estoque to service_role;

-- Cada gravacao gera uma versao nova: e ela que detecta edicoes simultaneas (If-Match / campo versao).
create function public.produto_nova_versao()
 returns trigger language plpgsql set search_path = '' as $$
begin
  new.versao := old.versao + 1;
  new.atualizado_em := now();
  new.criado_em := old.criado_em;
  new.criado_por := old.criado_por;
  return new;
end;
$$;

create trigger produtos_nova_versao before update on public.produtos
  for each row execute function public.produto_nova_versao();

create function public.produto_estoque_inicial()
 returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.movimentacoes_estoque (produto_id, tipo, quantidade, saldo_anterior, saldo_apos, motivo, criado_por)
  values (new.id, 'ENTRADA', new.quantidade_em_estoque, 0, new.quantidade_em_estoque, 'Estoque inicial', new.criado_por);
  return null;
end;
$$;

create trigger produtos_estoque_inicial after insert on public.produtos
  for each row when (new.quantidade_em_estoque > 0) execute function public.produto_estoque_inicial();

-- Quantidade alterada pela edicao do produto vira um AJUSTE; entradas e saidas passam por registrar_movimentacao.
create function public.produto_ajuste_na_edicao()
 returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.movimentacao', true), '') = 'on' then
    return null;
  end if;
  insert into public.movimentacoes_estoque (produto_id, tipo, quantidade, saldo_anterior, saldo_apos, motivo, criado_por)
  values (new.id, 'AJUSTE', abs(new.quantidade_em_estoque - old.quantidade_em_estoque),
          old.quantidade_em_estoque, new.quantidade_em_estoque, 'Ajuste na edição do produto', new.atualizado_por);
  return null;
end;
$$;

create trigger produtos_ajuste_na_edicao after update on public.produtos
  for each row when (old.quantidade_em_estoque is distinct from new.quantidade_em_estoque)
  execute function public.produto_ajuste_na_edicao();

-- Trava a linha do produto, confere o saldo e grava produto e historico na mesma transacao.
create function public.registrar_movimentacao(p_produto_id uuid, p_tipo text, p_quantidade integer,
                                              p_motivo text, p_usuario uuid)
 returns setof public.movimentacoes_estoque language plpgsql set search_path = '' as $$
declare
  v_saldo integer;
  v_novo integer;
begin
  if p_tipo not in ('ENTRADA', 'SAIDA') then
    raise exception using errcode = '22023', message = 'tipo_invalido';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception using errcode = '22023', message = 'quantidade_invalida';
  end if;

  select quantidade_em_estoque into v_saldo from public.produtos where id = p_produto_id for update;
  if not found then
    return;
  end if;

  if p_tipo = 'SAIDA' and p_quantidade > v_saldo then
    raise exception using errcode = 'P0001', message = 'estoque_insuficiente', detail = v_saldo::text;
  end if;
  v_novo := case when p_tipo = 'ENTRADA' then v_saldo + p_quantidade else v_saldo - p_quantidade end;

  perform set_config('app.movimentacao', 'on', true);
  update public.produtos set quantidade_em_estoque = v_novo, atualizado_por = p_usuario where id = p_produto_id;
  perform set_config('app.movimentacao', 'off', true);

  return query
    insert into public.movimentacoes_estoque (produto_id, tipo, quantidade, saldo_anterior, saldo_apos, motivo, criado_por)
    values (p_produto_id, p_tipo, p_quantidade, v_saldo, v_novo, nullif(btrim(p_motivo), ''), p_usuario)
    returning *;
end;
$$;

-- Indicadores do dashboard; produtos inativos ficam de fora.
create function public.resumo_estoque(p_limite integer)
 returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'totalProdutos', count(*),
    'totalItens', coalesce(sum(quantidade_em_estoque), 0),
    'valorTotal', coalesce(sum(preco * quantidade_em_estoque), 0),
    'esgotados', count(*) filter (where quantidade_em_estoque = 0),
    'estoqueBaixo', count(*) filter (where quantidade_em_estoque between 1 and p_limite))
  from public.produtos
  where ativo;
$$;

revoke execute on function public.produto_nova_versao(), public.produto_estoque_inicial(), public.produto_ajuste_na_edicao(),
  public.registrar_movimentacao(uuid, text, integer, text, uuid), public.resumo_estoque(integer)
  from public, anon, authenticated;
grant execute on function public.registrar_movimentacao(uuid, text, integer, text, uuid), public.resumo_estoque(integer)
  to service_role;
