-- notificacoes
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('LEAD_ATRIBUIDO','RECLAMACAO_ABERTA','RECLAMACAO_ATRIBUIDA','DEMANDA_ATRIBUIDA','CONTA_VENCENDO','CONTA_VENCIDA')),
  titulo text not null check (char_length(titulo) <= 150),
  mensagem text check (char_length(mensagem) <= 500),
  link text check (char_length(link) <= 200),
  chave text check (char_length(chave) <= 120),
  lida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index notificacoes_usuario_idx on public.notificacoes (usuario_id, criado_em desc);
create index notificacoes_nao_lidas_idx on public.notificacoes (usuario_id) where lida_em is null;
create unique index notificacoes_chave_idx on public.notificacoes (usuario_id, chave) where chave is not null;

create table public.preferencias_notificacao (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('LEAD_ATRIBUIDO','RECLAMACAO_ABERTA','RECLAMACAO_ATRIBUIDA','DEMANDA_ATRIBUIDA','CONTA_VENCENDO','CONTA_VENCIDA')),
  no_app boolean not null default true,
  por_email boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, tipo)
);
create trigger preferencias_notificacao_atualizado_em before update on public.preferencias_notificacao
  for each row execute function public.tocar_atualizado_em();

alter table public.notificacoes enable row level security;
alter table public.preferencias_notificacao enable row level security;
revoke all on public.notificacoes, public.preferencias_notificacao from anon, authenticated;
grant select, insert, update, delete on public.notificacoes, public.preferencias_notificacao to service_role;

-- Quem pode usar uma subaba: administradores, acesso total, a subaba ou o módulo inteiro.
create or replace function public.tem_subaba(p_usuario uuid, p_chave text)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.perfis p
     where p.id = p_usuario
       and (p.papel = 'ADMIN' or p.acessos ? '*' or p.acessos ? p_chave or p.acessos ? split_part(p_chave, '/', 1))
  );
$$;

-- Grava a notificação se a pessoa não a desligou; com chave, não repete o mesmo aviso.
create or replace function public.notificar(p_usuario uuid, p_tipo text, p_titulo text, p_mensagem text, p_link text, p_chave text default null)
returns void language plpgsql set search_path = '' as $$
begin
  if p_usuario is null then
    return;
  end if;
  if exists (select 1 from public.preferencias_notificacao
              where usuario_id = p_usuario and tipo = p_tipo and not no_app) then
    return;
  end if;
  insert into public.notificacoes (usuario_id, tipo, titulo, mensagem, link, chave)
  values (p_usuario, p_tipo, left(p_titulo, 150), left(p_mensagem, 500), p_link, p_chave)
  on conflict (usuario_id, chave) where chave is not null do nothing;
end;
$$;

create or replace function public.notificar_lead()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.responsavel_id is not null
     and (tg_op = 'INSERT' and new.responsavel_id is distinct from new.criado_por
          or tg_op = 'UPDATE' and new.responsavel_id is distinct from old.responsavel_id) then
    perform public.notificar(new.responsavel_id, 'LEAD_ATRIBUIDO', 'Lead atribuído a você: ' || new.nome,
      coalesce(new.empresa, new.email, new.telefone), '/crm/leads');
  end if;
  return null;
end;
$$;
create trigger leads_notificar after insert or update of responsavel_id on public.leads
  for each row execute function public.notificar_lead();

create or replace function public.notificar_reclamacao()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_destino uuid;
begin
  if tg_op = 'INSERT' then
    if new.responsavel_id is not null then
      if new.responsavel_id is distinct from new.criado_por then
        perform public.notificar(new.responsavel_id, 'RECLAMACAO_ATRIBUIDA',
          'Reclamação ' || new.protocolo || ' atribuída a você', new.assunto, '/crm/reclamacoes');
      end if;
    else
      for v_destino in
        select p.id from public.perfis p
         where public.tem_subaba(p.id, 'crm/reclamacoes') and p.id is distinct from new.criado_por
      loop
        perform public.notificar(v_destino, 'RECLAMACAO_ABERTA',
          'Nova reclamação ' || new.protocolo, new.assunto, '/crm/reclamacoes');
      end loop;
    end if;
  elsif new.responsavel_id is not null and new.responsavel_id is distinct from old.responsavel_id
        and new.responsavel_id is distinct from new.atualizado_por then
    perform public.notificar(new.responsavel_id, 'RECLAMACAO_ATRIBUIDA',
      'Reclamação ' || new.protocolo || ' atribuída a você', new.assunto, '/crm/reclamacoes');
  end if;
  return null;
end;
$$;
create trigger reclamacoes_notificar after insert or update of responsavel_id on public.reclamacoes
  for each row execute function public.notificar_reclamacao();

create or replace function public.notificar_demanda()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_destino uuid;
begin
  for v_destino in
    select unnest(coalesce(new.responsaveis, '{}'::uuid[]))
    except
    select unnest(case when tg_op = 'UPDATE' then coalesce(old.responsaveis, '{}'::uuid[]) else '{}'::uuid[] end)
  loop
    if v_destino is distinct from new.criado_por or tg_op = 'UPDATE' then
      perform public.notificar(v_destino, 'DEMANDA_ATRIBUIDA', 'Demanda atribuída a você: ' || new.titulo,
        case when new.prazo is not null then 'Prazo: ' || to_char(new.prazo, 'DD/MM/YYYY') end,
        '/demandas/quadro?abrir=' || new.id);
    end if;
  end loop;
  return null;
end;
$$;
create trigger demandas_notificar after insert or update of responsaveis on public.demandas
  for each row execute function public.notificar_demanda();

-- Rotina diária: contas pendentes que vencem nos próximos 3 dias ou já venceram, para quem usa a subaba.
create or replace function public.notificar_vencimentos()
returns integer language plpgsql set search_path = '' as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_total integer := 0;
  v_conta record;
  v_destino uuid;
begin
  for v_conta in
    select 'contas-pagar' as subaba, 'a pagar' as rotulo, id, descricao, favorecido as pessoa, valor_liquido, vencimento
      from public.contas_pagar where status = 'PENDENTE' and vencimento <= v_hoje + 3
    union all
    select 'contas-receber', 'a receber', id, descricao, pagador, valor_liquido, vencimento
      from public.contas_receber where status = 'PENDENTE' and vencimento <= v_hoje + 3
  loop
    for v_destino in
      select p.id from public.perfis p where public.tem_subaba(p.id, 'financeiro/' || v_conta.subaba)
    loop
      if v_conta.vencimento < v_hoje then
        perform public.notificar(v_destino, 'CONTA_VENCIDA', 'Conta ' || v_conta.rotulo || ' vencida: ' || v_conta.descricao,
          v_conta.pessoa || ' · R$ ' || to_char(v_conta.valor_liquido, 'FM999G999G990D00') || ' · venceu em ' || to_char(v_conta.vencimento, 'DD/MM/YYYY'),
          '/financeiro/' || v_conta.subaba, 'vencida:' || v_conta.id);
      else
        perform public.notificar(v_destino, 'CONTA_VENCENDO', 'Conta ' || v_conta.rotulo || ' vence em breve: ' || v_conta.descricao,
          v_conta.pessoa || ' · R$ ' || to_char(v_conta.valor_liquido, 'FM999G999G990D00') || ' · vence em ' || to_char(v_conta.vencimento, 'DD/MM/YYYY'),
          '/financeiro/' || v_conta.subaba, 'vencendo:' || v_conta.id);
      end if;
      v_total := v_total + 1;
    end loop;
  end loop;
  delete from public.notificacoes where lida_em is not null and lida_em < now() - interval '90 days';
  return v_total;
end;
$$;

revoke execute on function public.tem_subaba(uuid, text), public.notificar(uuid, text, text, text, text, text),
  public.notificar_lead(), public.notificar_reclamacao(), public.notificar_demanda(), public.notificar_vencimentos()
  from public, anon, authenticated;
grant execute on function public.notificar_vencimentos() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('notificar-vencimentos', '0 11 * * *', 'select public.notificar_vencimentos()');
