-- fornecedores_e_centros_custo
create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null check (char_length(btrim(razao_social)) between 2 and 150),
  nome_fantasia text check (char_length(nome_fantasia) <= 150),
  documento text unique check (documento ~ '^([0-9]{11}|[0-9]{14})$'),
  contato text check (char_length(contato) <= 100),
  email text check (char_length(email) <= 254),
  telefone text check (char_length(telefone) <= 30),
  chave_pix text check (char_length(chave_pix) <= 140),
  categoria text check (char_length(categoria) <= 60),
  observacoes text check (char_length(observacoes) <= 1000),
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index fornecedores_razao_social_idx on public.fornecedores (lower(razao_social));

create table public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-Z0-9][A-Z0-9._-]{0,19}$'),
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  descricao text check (char_length(descricao) <= 300),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger fornecedores_atualizado_em before update on public.fornecedores
  for each row execute function public.tocar_atualizado_em();
create trigger centros_custo_atualizado_em before update on public.centros_custo
  for each row execute function public.tocar_atualizado_em();

alter table public.contas_pagar
  add column fornecedor_id uuid references public.fornecedores(id),
  add column centro_custo_id uuid references public.centros_custo(id);
alter table public.contas_receber
  add column centro_custo_id uuid references public.centros_custo(id);
create index contas_pagar_fornecedor_idx on public.contas_pagar (fornecedor_id);
create index contas_pagar_centro_custo_idx on public.contas_pagar (centro_custo_id);
create index contas_receber_centro_custo_idx on public.contas_receber (centro_custo_id);

alter table public.fornecedores enable row level security;
alter table public.centros_custo enable row level security;
revoke all on public.fornecedores, public.centros_custo from anon, authenticated;
grant select, insert, update, delete on public.fornecedores, public.centros_custo to service_role;

insert into public.centros_custo (codigo, nome, descricao) values
  ('ADM', 'Administrativo', 'Despesas gerais do escritório'),
  ('COM', 'Comercial', 'Vendas, marketing e relacionamento'),
  ('OPE', 'Operações', 'Logística, estoque e entregas'),
  ('TEC', 'Tecnologia', 'Sistemas, licenças e equipamentos');
