-- webhooks
create table public.webhooks_saida (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  eventos text[] not null check (cardinality(eventos) > 0 and eventos <@ array['cliente.criado','lead.criado','lead.etapa_alterada','lead.convertido','reclamacao.aberta','reclamacao.status_alterado','conta.paga','produto.estoque_baixo']),
  segredo text not null check (char_length(segredo) between 32 and 128),
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index webhooks_saida_eventos_idx on public.webhooks_saida using gin (eventos) where ativo;
create trigger webhooks_saida_atualizado_em before update on public.webhooks_saida for each row execute function public.tocar_atualizado_em();

create table public.webhook_entregas (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks_saida(id) on delete cascade,
  evento text not null,
  payload jsonb not null,
  status_http integer,
  sucesso boolean not null,
  tentativas integer not null default 1,
  erro text check (char_length(erro) <= 500),
  duracao_ms integer,
  criado_em timestamptz not null default now()
);
create index webhook_entregas_idx on public.webhook_entregas (webhook_id, criado_em desc);
create index webhook_entregas_data_idx on public.webhook_entregas (criado_em desc);

create table public.webhooks_entrada (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  token text not null unique check (char_length(token) between 32 and 128),
  acao text not null default 'CRIAR_LEAD' check (acao in ('CRIAR_LEAD')),
  origem_id uuid references public.crm_origens(id) on delete set null,
  ativo boolean not null default true,
  total_recebidos integer not null default 0,
  ultimo_uso_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger webhooks_entrada_atualizado_em before update on public.webhooks_entrada for each row execute function public.tocar_atualizado_em();

alter table public.webhooks_saida enable row level security;
alter table public.webhook_entregas enable row level security;
alter table public.webhooks_entrada enable row level security;
revoke all on public.webhooks_saida, public.webhook_entregas, public.webhooks_entrada from anon, authenticated;
grant select, insert, update, delete on public.webhooks_saida, public.webhook_entregas, public.webhooks_entrada to service_role;

-- Conta o uso do webhook de entrada sem disputa entre requisições simultâneas.
create or replace function public.registrar_uso_webhook_entrada(p_id uuid)
returns void language sql set search_path = '' as $$
  update public.webhooks_entrada set total_recebidos = total_recebidos + 1, ultimo_uso_em = now() where id = p_id;
$$;
revoke execute on function public.registrar_uso_webhook_entrada(uuid) from public, anon, authenticated;
grant execute on function public.registrar_uso_webhook_entrada(uuid) to service_role;

select cron.schedule('limpar-entregas-webhook', '30 6 * * *', $$delete from public.webhook_entregas where criado_em < now() - interval '30 days'$$);
