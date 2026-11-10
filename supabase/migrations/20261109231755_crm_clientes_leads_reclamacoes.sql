-- crm_clientes_leads_reclamacoes
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'PF' check (tipo in ('PF','PJ')),
  nome text not null check (char_length(btrim(nome)) between 2 and 150),
  documento text unique check (documento ~ '^([0-9]{11}|[0-9]{14})$'),
  email text check (char_length(email) <= 254),
  telefone text check (char_length(telefone) <= 30),
  data_nascimento date,
  cep text check (cep ~ '^[0-9]{8}$'),
  endereco text check (char_length(endereco) <= 200),
  cidade text check (char_length(cidade) <= 80),
  uf text check (uf ~ '^[A-Z]{2}$'),
  origem text check (char_length(origem) <= 60),
  responsavel_id uuid references auth.users(id) on delete set null,
  observacoes text check (char_length(observacoes) <= 2000),
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index clientes_nome_idx on public.clientes (lower(nome));
create trigger clientes_atualizado_em before update on public.clientes for each row execute function public.tocar_atualizado_em();

alter table public.contas_receber add column cliente_id uuid references public.clientes(id);
create index contas_receber_cliente_idx on public.contas_receber (cliente_id);

create table public.crm_etapas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 2 and 40),
  ordem integer not null default 0,
  cor text not null default '#64748b' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  tipo text not null default 'ABERTA' check (tipo in ('ABERTA','GANHO','PERDIDO')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.crm_origens (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 2 and 40),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 150),
  empresa text check (char_length(empresa) <= 150),
  email text check (char_length(email) <= 254),
  telefone text check (char_length(telefone) <= 30),
  origem_id uuid references public.crm_origens(id) on delete set null,
  etapa_id uuid not null references public.crm_etapas(id),
  valor_estimado numeric(12,2) check (valor_estimado >= 0),
  responsavel_id uuid references auth.users(id) on delete set null,
  proxima_acao text check (char_length(proxima_acao) <= 200),
  proxima_acao_em date,
  motivo_perda text check (char_length(motivo_perda) <= 300),
  observacoes text check (char_length(observacoes) <= 2000),
  ordem double precision not null default extract(epoch from clock_timestamp()),
  cliente_id uuid references public.clientes(id) on delete set null,
  convertido_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index leads_etapa_idx on public.leads (etapa_id, ordem);
create index leads_responsavel_idx on public.leads (responsavel_id);
create trigger leads_atualizado_em before update on public.leads for each row execute function public.tocar_atualizado_em();

create table public.crm_interacoes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('LIGACAO','EMAIL','REUNIAO','WHATSAPP','NOTA')),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 2000),
  registrado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default clock_timestamp(),
  check (lead_id is not null or cliente_id is not null)
);
create index crm_interacoes_lead_idx on public.crm_interacoes (lead_id, criado_em desc);
create index crm_interacoes_cliente_idx on public.crm_interacoes (cliente_id, criado_em desc);

create sequence public.reclamacoes_protocolo_seq;

create table public.reclamacoes (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique,
  cliente_id uuid references public.clientes(id),
  nome_contato text check (char_length(nome_contato) <= 150),
  contato text check (char_length(contato) <= 150),
  assunto text not null check (char_length(btrim(assunto)) between 3 and 150),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 4000),
  canal text check (canal in ('TELEFONE','EMAIL','WHATSAPP','PRESENCIAL','SITE','REDES_SOCIAIS')),
  prioridade text not null default 'MEDIA' check (prioridade in ('BAIXA','MEDIA','ALTA','CRITICA')),
  status text not null default 'ABERTA' check (status in ('ABERTA','EM_ANALISE','RESOLVIDA','ENCERRADA')),
  responsavel_id uuid references auth.users(id) on delete set null,
  prazo date,
  solucao text check (char_length(solucao) <= 4000),
  resolvida_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (cliente_id is not null or nome_contato is not null)
);
create index reclamacoes_status_idx on public.reclamacoes (status, prazo);
create index reclamacoes_cliente_idx on public.reclamacoes (cliente_id);
create trigger reclamacoes_atualizado_em before update on public.reclamacoes for each row execute function public.tocar_atualizado_em();

create table public.reclamacao_eventos (
  id uuid primary key default gen_random_uuid(),
  reclamacao_id uuid not null references public.reclamacoes(id) on delete cascade,
  tipo text not null check (tipo in ('CRIADA','STATUS','COMENTARIO')),
  status_anterior text,
  status_novo text,
  comentario text check (char_length(comentario) <= 2000),
  autor_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default clock_timestamp()
);
create index reclamacao_eventos_idx on public.reclamacao_eventos (reclamacao_id, criado_em);

create or replace function public.reclamacao_protocolo()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.protocolo := 'REC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.reclamacoes_protocolo_seq')::text, 5, '0');
  return new;
end;
$$;
create trigger reclamacoes_protocolo before insert on public.reclamacoes for each row execute function public.reclamacao_protocolo();

create or replace function public.reclamacao_resolvida_em()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('RESOLVIDA','ENCERRADA') and old.status not in ('RESOLVIDA','ENCERRADA') then
    new.resolvida_em := now();
  elsif new.status in ('ABERTA','EM_ANALISE') then
    new.resolvida_em := null;
  end if;
  return new;
end;
$$;
create trigger reclamacoes_resolvida_em before update of status on public.reclamacoes for each row execute function public.reclamacao_resolvida_em();

create or replace function public.reclamacao_historico()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.reclamacao_eventos (reclamacao_id, tipo, status_novo, autor_id)
    values (new.id, 'CRIADA', new.status, new.criado_por);
  elsif new.status is distinct from old.status then
    insert into public.reclamacao_eventos (reclamacao_id, tipo, status_anterior, status_novo, autor_id)
    values (new.id, 'STATUS', old.status, new.status, new.atualizado_por);
  end if;
  return null;
end;
$$;
create trigger reclamacoes_historico after insert or update of status on public.reclamacoes for each row execute function public.reclamacao_historico();

create or replace function public.converter_lead(p_lead_id uuid, p_usuario uuid)
returns setof public.leads language plpgsql set search_path = '' as $$
declare
  v_lead public.leads;
  v_cliente uuid;
  v_ganho uuid;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    return;
  end if;
  if v_lead.cliente_id is not null then
    raise exception 'Este lead já foi convertido em cliente';
  end if;
  select id into v_ganho from public.crm_etapas where tipo = 'GANHO' and ativo order by ordem limit 1;
  if v_ganho is null then
    raise exception 'Cadastre uma etapa do tipo Ganho nos parâmetros do CRM';
  end if;
  insert into public.clientes (tipo, nome, email, telefone, origem, responsavel_id, observacoes, criado_por)
  values (
    case when v_lead.empresa is not null then 'PJ' else 'PF' end,
    coalesce(v_lead.empresa, v_lead.nome),
    v_lead.email, v_lead.telefone,
    (select nome from public.crm_origens where id = v_lead.origem_id),
    coalesce(v_lead.responsavel_id, p_usuario),
    case when v_lead.empresa is not null then 'Contato: ' || v_lead.nome end,
    p_usuario)
  returning id into v_cliente;
  insert into public.crm_interacoes (cliente_id, tipo, descricao, registrado_por)
  values (v_cliente, 'NOTA', 'Cliente criado a partir do lead "' || v_lead.nome || '".', p_usuario);
  return query
    update public.leads
       set cliente_id = v_cliente, etapa_id = v_ganho, convertido_em = now(), motivo_perda = null
     where id = p_lead_id
    returning *;
end;
$$;

alter table public.clientes enable row level security;
alter table public.crm_etapas enable row level security;
alter table public.crm_origens enable row level security;
alter table public.leads enable row level security;
alter table public.crm_interacoes enable row level security;
alter table public.reclamacoes enable row level security;
alter table public.reclamacao_eventos enable row level security;
revoke all on public.clientes, public.crm_etapas, public.crm_origens, public.leads, public.crm_interacoes,
  public.reclamacoes, public.reclamacao_eventos from anon, authenticated;
grant select, insert, update, delete on public.clientes, public.crm_etapas, public.crm_origens, public.leads,
  public.crm_interacoes, public.reclamacoes, public.reclamacao_eventos to service_role;
revoke all on sequence public.reclamacoes_protocolo_seq from anon, authenticated;
grant usage on sequence public.reclamacoes_protocolo_seq to service_role;
revoke execute on function public.converter_lead(uuid, uuid), public.reclamacao_protocolo(),
  public.reclamacao_resolvida_em(), public.reclamacao_historico() from public, anon, authenticated;
grant execute on function public.converter_lead(uuid, uuid) to service_role;

insert into public.crm_etapas (nome, ordem, cor, tipo) values
  ('Novo', 1, '#64748b', 'ABERTA'),
  ('Em contato', 2, '#0ea5e9', 'ABERTA'),
  ('Proposta', 3, '#f59e0b', 'ABERTA'),
  ('Ganho', 4, '#16a34a', 'GANHO'),
  ('Perdido', 5, '#dc2626', 'PERDIDO');
insert into public.crm_origens (nome) values ('Site'), ('Indicação'), ('Instagram'), ('WhatsApp'), ('Evento'), ('Outro');
