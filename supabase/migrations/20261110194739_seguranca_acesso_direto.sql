-- seguranca_acesso_direto
-- Grupos de permissao (acessos somados aos do perfil)
create table public.grupos_permissao (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 2 and 60),
  descricao text check (char_length(descricao) <= 300),
  acessos jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create table public.grupos_permissao_membros (
  grupo_id uuid not null references public.grupos_permissao(id) on delete cascade,
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (grupo_id, usuario_id)
);
create index grupos_permissao_membros_usuario on public.grupos_permissao_membros(usuario_id);
create trigger grupos_permissao_atualizado_em before update on public.grupos_permissao
  for each row execute function public.tocar_atualizado_em();
alter table public.grupos_permissao enable row level security;
alter table public.grupos_permissao_membros enable row level security;

-- Chaves de acesso
create or replace function public.chaves_somente_admin()
returns text[] language sql immutable set search_path = '' as $$
  select array['configuracoes/usuarios','configuracoes/webhooks','configuracoes/integracoes',
               'configuracoes/parametros-crm','configuracoes/sistema','configuracoes/grupos',
               'configuracoes/auditoria']
$$;

create or replace function public.acessos_formato_valido(p_acessos jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_acessos) = 'array'
     and not jsonb_path_exists(p_acessos, '$[*] ? (@.type() != "string" || !(@ like_regex "^([*]|[a-z]+(-[a-z]+)*(/[a-z]+(-[a-z]+)*)?)$"))')
$$;

alter table public.perfis drop constraint perfis_acessos_validos;
alter table public.perfis add constraint perfis_acessos_validos check (
  public.acessos_formato_valido(acessos)
  and (papel = 'ADMIN' or not acessos ?| public.chaves_somente_admin())
);
alter table public.grupos_permissao add constraint grupos_permissao_acessos_validos check (
  public.acessos_formato_valido(acessos)
  and not acessos ? '*'
  and not acessos ?| public.chaves_somente_admin()
);

-- p_chave pode ser 'modulo/subaba' ou so 'modulo' (qualquer subaba do modulo)
create or replace function public.acessos_cobrem(p_acessos jsonb, p_chave text)
returns boolean language sql immutable set search_path = '' as $$
  select p_acessos ? '*' or p_acessos ? p_chave or p_acessos ? split_part(p_chave, '/', 1)
      or (position('/' in p_chave) = 0
          and exists (select 1 from jsonb_array_elements_text(p_acessos) a where a like p_chave || '/%'))
$$;

create or replace function public.juntar_acessos(p_base jsonb, p_usuario uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(distinct a order by a), '[]'::jsonb) from (
    select jsonb_array_elements_text(coalesce(p_base, '[]'::jsonb)) a
    union
    select jsonb_array_elements_text(g.acessos)
      from public.grupos_permissao g
      join public.grupos_permissao_membros m on m.grupo_id = g.id
     where m.usuario_id = p_usuario and g.ativo
  ) x
$$;

create or replace function public.acessos_efetivos(p_usuario uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.juntar_acessos(p.acessos, p.id) from public.perfis p where p.id = p_usuario
$$;

create or replace function public.tem_subaba(p_usuario uuid, p_chave text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.papel = 'ADMIN' or public.acessos_cobrem(public.juntar_acessos(p.acessos, p.id), p_chave)
                     from public.perfis p where p.id = p_usuario), false)
$$;

create or replace function public.pode_acessar(p_chave text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.tem_subaba((select auth.uid()), p_chave)
$$;

create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where id = (select auth.uid()) and papel = 'ADMIN')
$$;

-- Token: papel + acessos efetivos (perfil + grupos)
create or replace function public.sincronizar_papel_no_token()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('papel', new.papel, 'acessos', public.juntar_acessos(new.acessos, new.id))
   where id = new.id;
  return new;
end;
$$;

create or replace function public.ressincronizar_usuario(p_usuario uuid)
returns void language sql security definer set search_path = '' as $$
  update auth.users u
     set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('papel', p.papel, 'acessos', public.juntar_acessos(p.acessos, p.id))
    from public.perfis p
   where p.id = p_usuario and u.id = p.id
$$;

create or replace function public.grupo_membro_alterado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.ressincronizar_usuario(coalesce(new.usuario_id, old.usuario_id));
  return null;
end;
$$;
create trigger grupos_membros_token after insert or delete on public.grupos_permissao_membros
  for each row execute function public.grupo_membro_alterado();

create or replace function public.grupo_alterado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.ressincronizar_usuario(m.usuario_id)
     from public.grupos_permissao_membros m where m.grupo_id = new.id;
  return null;
end;
$$;
create trigger grupos_permissao_token after update of acessos, ativo on public.grupos_permissao
  for each row execute function public.grupo_alterado();

-- Autoria automatica a partir do usuario logado
create or replace function public.preencher_atualizado_por()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_por := coalesce((select auth.uid()), new.atualizado_por);
  return new;
end;
$$;
create trigger produtos_atualizado_por before update on public.produtos
  for each row execute function public.preencher_atualizado_por();
create trigger reclamacoes_atualizado_por before update on public.reclamacoes
  for each row execute function public.preencher_atualizado_por();

do $$
declare t text;
begin
  foreach t in array array['clientes','contas_pagar','contas_receber','demandas','fornecedores','leads',
                           'movimentacoes_estoque','produtos','reclamacoes','webhooks_entrada','webhooks_saida'] loop
    execute format('alter table public.%I alter column criado_por set default auth.uid()', t);
  end loop;
end $$;
alter table public.crm_interacoes alter column registrado_por set default auth.uid();
alter table public.reclamacao_eventos alter column autor_id set default auth.uid();

-- Gatilhos que notificam outras pessoas rodam como dono
alter function public.notificar_demanda() security definer;
alter function public.notificar_lead() security definer;
alter function public.notificar_reclamacao() security definer;
alter function public.notificar(uuid, text, text, text, text, text) security definer;

-- Politicas: (tabela, chave para ler, chave para gravar)
do $$
declare
  r record;
begin
  for r in select * from (values
    ('centros_custo',        'financeiro',               'financeiro/centros-custo'),
    ('fornecedores',         'financeiro',               'financeiro/fornecedores'),
    ('contas_pagar',         'financeiro/contas-pagar',  'financeiro/contas-pagar'),
    ('contas_receber',       'financeiro/contas-receber','financeiro/contas-receber'),
    ('crm_etapas',           'crm',                      'configuracoes/parametros-crm'),
    ('crm_origens',          'crm',                      'configuracoes/parametros-crm'),
    ('crm_interacoes',       'crm',                      'crm'),
    ('leads',                'crm/leads',                'crm/leads'),
    ('reclamacoes',          'crm',                      'crm/reclamacoes'),
    ('reclamacao_eventos',   'crm',                      'crm/reclamacoes'),
    ('webhooks_saida',       'configuracoes/webhooks',   'configuracoes/webhooks'),
    ('webhooks_entrada',     'configuracoes/webhooks',   'configuracoes/webhooks'),
    ('webhook_entregas',     'configuracoes/webhooks',   'configuracoes/webhooks'),
    ('grupos_permissao',     'configuracoes/grupos',     'configuracoes/grupos'),
    ('grupos_permissao_membros','configuracoes/grupos',  'configuracoes/grupos')
  ) v(tabela, ler, gravar) loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.pode_acessar(%L)))', r.tabela || '_ler', r.tabela, r.ler);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.pode_acessar(%L)))', r.tabela || '_incluir', r.tabela, r.gravar);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.pode_acessar(%L))) with check ((select public.pode_acessar(%L)))', r.tabela || '_alterar', r.tabela, r.gravar, r.gravar);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.pode_acessar(%L)))', r.tabela || '_excluir', r.tabela, r.gravar);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.tabela);
  end loop;
end $$;

-- clientes: CRM ou financeiro leem
create policy clientes_ler on public.clientes for select to authenticated
  using ((select public.pode_acessar('crm')) or (select public.pode_acessar('financeiro')));
create policy clientes_incluir on public.clientes for insert to authenticated
  with check ((select public.pode_acessar('crm/clientes')));
create policy clientes_alterar on public.clientes for update to authenticated
  using ((select public.pode_acessar('crm/clientes'))) with check ((select public.pode_acessar('crm/clientes')));
create policy clientes_excluir on public.clientes for delete to authenticated
  using ((select public.pode_acessar('crm/clientes')));
grant select, insert, update, delete on public.clientes to authenticated;

-- demandas: exclusao so do criador ou admin
create policy demandas_ler on public.demandas for select to authenticated using ((select public.pode_acessar('demandas')));
create policy demandas_incluir on public.demandas for insert to authenticated with check ((select public.pode_acessar('demandas')));
create policy demandas_alterar on public.demandas for update to authenticated
  using ((select public.pode_acessar('demandas'))) with check ((select public.pode_acessar('demandas')));
create policy demandas_excluir on public.demandas for delete to authenticated
  using ((select public.pode_acessar('demandas')) and (criado_por = (select auth.uid()) or (select public.e_admin())));
grant select, insert, update, delete on public.demandas to authenticated;

-- estoque
create policy produtos_ler on public.produtos for select to authenticated
  using ((select public.pode_acessar('estoque')) or (select public.pode_acessar('inicio/dashboard')));
create policy produtos_incluir on public.produtos for insert to authenticated with check ((select public.pode_acessar('estoque/produtos')));
create policy produtos_alterar on public.produtos for update to authenticated
  using ((select public.pode_acessar('estoque/produtos'))) with check ((select public.pode_acessar('estoque/produtos')));
create policy produtos_excluir on public.produtos for delete to authenticated using ((select public.pode_acessar('estoque/produtos')));
grant select, insert, update, delete on public.produtos to authenticated;

create policy movimentacoes_ler on public.movimentacoes_estoque for select to authenticated
  using ((select public.pode_acessar('estoque')) or (select public.pode_acessar('inicio/dashboard')));
create policy movimentacoes_incluir on public.movimentacoes_estoque for insert to authenticated
  with check ((select public.pode_acessar('estoque/produtos')));
grant select, insert on public.movimentacoes_estoque to authenticated;

-- dados pessoais
create policy notificacoes_proprias_ler on public.notificacoes for select to authenticated using (usuario_id = (select auth.uid()));
create policy notificacoes_proprias_alterar on public.notificacoes for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy notificacoes_proprias_excluir on public.notificacoes for delete to authenticated using (usuario_id = (select auth.uid()));
grant select, delete on public.notificacoes to authenticated;
grant update (lida_em) on public.notificacoes to authenticated;

create policy preferencias_proprias on public.preferencias_notificacao for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
grant select, insert, update, delete on public.preferencias_notificacao to authenticated;

create policy perfis_ler on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.pode_acessar('configuracoes/usuarios')));
create policy perfis_alterar on public.perfis for update to authenticated
  using (id = (select auth.uid()) or (select public.pode_acessar('configuracoes/usuarios')))
  with check (id = (select auth.uid()) or (select public.pode_acessar('configuracoes/usuarios')));
grant select on public.perfis to authenticated;
grant update (nome, telefone, bio, avatar_url) on public.perfis to authenticated;

-- Lista enxuta de pessoas para campos de responsavel
create or replace function public.opcoes_usuarios()
returns table (id uuid, nome text, avatar_url text, departamento text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.avatar_url, p.departamento
    from public.perfis p
   where (select auth.uid()) is not null
   order by p.nome
$$;

grant usage, select on all sequences in schema public to authenticated;

-- RPCs usadas pelo painel
create or replace function public.converter_lead(p_lead_id uuid, p_usuario uuid default null)
returns setof public.leads language plpgsql security definer set search_path = '' as $$
declare
  v_lead public.leads;
  v_cliente uuid;
  v_ganho uuid;
  v_usuario uuid := coalesce((select auth.uid()), p_usuario);
begin
  if (select auth.uid()) is not null and not public.pode_acessar('crm/leads') then
    raise exception using errcode = '42501', message = 'sem_permissao';
  end if;
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
    coalesce(v_lead.responsavel_id, v_usuario),
    case when v_lead.empresa is not null then 'Contato: ' || v_lead.nome end,
    v_usuario)
  returning id into v_cliente;
  insert into public.crm_interacoes (cliente_id, tipo, descricao, registrado_por)
  values (v_cliente, 'NOTA', 'Cliente criado a partir do lead "' || v_lead.nome || '".', v_usuario);
  return query
    update public.leads
       set cliente_id = v_cliente, etapa_id = v_ganho, convertido_em = now(), motivo_perda = null
     where id = p_lead_id
    returning *;
end;
$$;
drop function if exists public.converter_lead(uuid, uuid) cascade;
