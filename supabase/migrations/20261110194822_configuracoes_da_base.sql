-- configuracoes_da_base
-- Parametros gerais (marca, empresa, regional). publico = legivel antes do login
create table public.parametros_sistema (
  chave text primary key check (chave ~ '^[a-z][a-z0-9_]{1,40}$'),
  valor jsonb not null default '{}'::jsonb,
  descricao text check (char_length(descricao) <= 200),
  publico boolean not null default false,
  atualizado_em timestamptz not null default now()
);
create trigger parametros_sistema_atualizado_em before update on public.parametros_sistema
  for each row execute function public.tocar_atualizado_em();

insert into public.parametros_sistema (chave, valor, descricao, publico) values
  ('marca', '{"nome":"Tribo Raízes","nome_curto":"Tribo","cor_primaria":"#2e7d32","cor_secundaria":"#8d6e63","logo_url":null,"favicon_url":null}', 'Identidade visual do painel', true),
  ('empresa', '{"razao_social":null,"documento":null,"email":null,"telefone":null,"endereco":null,"site":null}', 'Dados da empresa usados em documentos', false),
  ('regional', '{"moeda":"BRL","idioma":"pt-BR","fuso":"America/Sao_Paulo"}', 'Moeda, idioma e fuso padrão', true);

-- Modulos ligados por cliente
create table public.modulos_ativos (
  modulo text primary key check (modulo ~ '^[a-z]+(-[a-z]+)*$'),
  rotulo text check (char_length(rotulo) <= 40),
  ativo boolean not null default true,
  ordem integer not null default 0
);
insert into public.modulos_ativos (modulo, ordem) values
  ('inicio', 1), ('estoque', 2), ('demandas', 3), ('financeiro', 4), ('comercial', 5),
  ('crm', 6), ('rh', 7), ('relatorios', 8), ('configuracoes', 9);

-- Campos extras por entidade
create table public.campos_extras (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade in ('clientes','leads','produtos','fornecedores','reclamacoes','demandas',
                                             'propostas_comerciais','pedidos_venda','pessoas_candidatas')),
  chave text not null check (chave ~ '^[a-z][a-z0-9_]{0,39}$'),
  rotulo text not null check (char_length(btrim(rotulo)) between 1 and 60),
  tipo text not null default 'texto' check (tipo in ('texto','textarea','email','numero','data','select','multipla','toggle')),
  opcoes jsonb not null default '[]'::jsonb check (jsonb_typeof(opcoes) = 'array'),
  obrigatorio boolean not null default false,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (entidade, chave)
);

do $$
declare t text;
begin
  foreach t in array array['clientes','leads','produtos','fornecedores','reclamacoes','demandas'] loop
    execute format('alter table public.%I add column extras jsonb not null default ''{}''::jsonb check (jsonb_typeof(extras) = ''object'')', t);
  end loop;
end $$;

-- Listas de valores configuraveis
create table public.listas_auxiliares (
  id uuid primary key default gen_random_uuid(),
  lista text not null check (lista ~ '^[a-z][a-z0-9_]{1,40}$'),
  valor text not null check (char_length(btrim(valor)) between 1 and 60),
  rotulo text not null check (char_length(btrim(rotulo)) between 1 and 80),
  cor text check (cor ~ '^#[0-9a-fA-F]{6}$'),
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (lista, valor)
);
insert into public.listas_auxiliares (lista, valor, rotulo, ordem) values
  ('formas_pagamento','PIX','Pix',1), ('formas_pagamento','BOLETO','Boleto',2),
  ('formas_pagamento','CARTAO','Cartão',3), ('formas_pagamento','TRANSFERENCIA','Transferência',4),
  ('formas_pagamento','DINHEIRO','Dinheiro',5),
  ('unidades','UN','Unidade',1), ('unidades','KG','Quilograma',2), ('unidades','CX','Caixa',3),
  ('unidades','L','Litro',4), ('unidades','H','Hora',5),
  ('canais_atendimento','TELEFONE','Telefone',1), ('canais_atendimento','EMAIL','E-mail',2),
  ('canais_atendimento','WHATSAPP','WhatsApp',3), ('canais_atendimento','PRESENCIAL','Presencial',4),
  ('motivos_perda','PRECO','Preço',1), ('motivos_perda','CONCORRENTE','Concorrente',2),
  ('motivos_perda','SEM_RETORNO','Sem retorno',3);

-- Numeracao de documentos
create table public.sequencias_documento (
  chave text primary key check (chave ~ '^[a-z][a-z0-9_]{1,40}$'),
  descricao text not null check (char_length(descricao) <= 80),
  prefixo text not null default '' check (char_length(prefixo) <= 12),
  digitos integer not null default 5 check (digitos between 1 and 10),
  incluir_ano boolean not null default true,
  reinicia_anual boolean not null default true,
  proximo bigint not null default 1 check (proximo > 0),
  ano_corrente integer not null default extract(year from now())::integer,
  atualizado_em timestamptz not null default now()
);
create trigger sequencias_documento_atualizado_em before update on public.sequencias_documento
  for each row execute function public.tocar_atualizado_em();
insert into public.sequencias_documento (chave, descricao, prefixo) values
  ('proposta', 'Propostas comerciais', 'PROP-'),
  ('pedido', 'Pedidos de venda', 'PED-'),
  ('vaga', 'Vagas de emprego', 'VAG-');

create or replace function public.proximo_numero(p_chave text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  s public.sequencias_documento;
  v_ano integer := extract(year from now())::integer;
begin
  select * into s from public.sequencias_documento where chave = p_chave for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'sequencia_inexistente', detail = p_chave;
  end if;
  if s.reinicia_anual and s.ano_corrente <> v_ano then
    s.proximo := 1;
  end if;
  update public.sequencias_documento set proximo = s.proximo + 1, ano_corrente = v_ano where chave = p_chave;
  return s.prefixo || case when s.incluir_ano then v_ano::text || '-' else '' end || lpad(s.proximo::text, s.digitos, '0');
end;
$$;
revoke execute on function public.proximo_numero(text) from public, anon, authenticated;

-- RLS
alter table public.parametros_sistema enable row level security;
alter table public.modulos_ativos enable row level security;
alter table public.campos_extras enable row level security;
alter table public.listas_auxiliares enable row level security;
alter table public.sequencias_documento enable row level security;

create policy parametros_publicos_ler on public.parametros_sistema for select to anon using (publico);
create policy parametros_ler on public.parametros_sistema for select to authenticated
  using (publico or (select public.pode_acessar('configuracoes/sistema')) or chave = 'empresa');
create policy parametros_gravar on public.parametros_sistema for all to authenticated
  using ((select public.pode_acessar('configuracoes/sistema'))) with check ((select public.pode_acessar('configuracoes/sistema')));
grant select on public.parametros_sistema to anon;
grant select, insert, update, delete on public.parametros_sistema to authenticated;

create policy modulos_ler on public.modulos_ativos for select to anon, authenticated using (true);
create policy modulos_gravar on public.modulos_ativos for all to authenticated
  using ((select public.pode_acessar('configuracoes/sistema'))) with check ((select public.pode_acessar('configuracoes/sistema')));
grant select on public.modulos_ativos to anon;
grant select, insert, update, delete on public.modulos_ativos to authenticated;

do $$
declare r record;
begin
  for r in select * from (values
    ('campos_extras', 'configuracoes/campos-extras'),
    ('listas_auxiliares', 'configuracoes/listas'),
    ('sequencias_documento', 'configuracoes/numeracao')
  ) v(tabela, gravar) loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', r.tabela || '_ler', r.tabela);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.pode_acessar(%L)))', r.tabela || '_incluir', r.tabela, r.gravar);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.pode_acessar(%L))) with check ((select public.pode_acessar(%L)))', r.tabela || '_alterar', r.tabela, r.gravar, r.gravar);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.pode_acessar(%L)))', r.tabela || '_excluir', r.tabela, r.gravar);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.tabela);
  end loop;
end $$;
