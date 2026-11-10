-- seguranca_rpcs_e_arquivos
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

create or replace function public.registrar_movimentacao(p_produto_id uuid, p_tipo text, p_quantidade integer, p_motivo text, p_usuario uuid)
returns setof public.movimentacoes_estoque language plpgsql set search_path = '' as $$
declare
  v_saldo integer;
  v_novo integer;
  v_usuario uuid := coalesce((select auth.uid()), p_usuario);
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
  update public.produtos set quantidade_em_estoque = v_novo, atualizado_por = v_usuario where id = p_produto_id;
  perform set_config('app.movimentacao', 'off', true);

  return query
    insert into public.movimentacoes_estoque (produto_id, tipo, quantidade, saldo_anterior, saldo_apos, motivo, criado_por)
    values (p_produto_id, p_tipo, p_quantidade, v_saldo, v_novo, nullif(btrim(p_motivo), ''), v_usuario)
    returning *;
end;
$$;

-- Relatorios: ponto unico com checagem da subaba
alter function public.relatorio_financeiro(date, date) security definer;
alter function public.relatorio_comercial(date, date) security definer;
alter function public.relatorio_atendimento(date, date) security definer;
alter function public.relatorio_estoque(integer) security definer;

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
    else null end;
end;
$$;

-- Execucao de funcoes: nada para anon/public; painel recebe so o necessario
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

grant execute on function
  public.pode_acessar(text), public.e_admin(), public.acessos_cobrem(jsonb, text),
  public.acessos_formato_valido(jsonb), public.chaves_somente_admin(),
  public.opcoes_usuarios(), public.relatorio(text, date, date, integer),
  public.converter_lead(uuid, uuid), public.mover_demanda(uuid, text, integer),
  public.registrar_movimentacao(uuid, text, integer, text, uuid),
  public.resumo_estoque(integer), public.resumo_financeiro(date)
to authenticated;

-- Storage: avatar na pasta do proprio usuario
create policy avatars_ler_proprio on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.pode_acessar('configuracoes/usuarios'))));
create policy avatars_enviar_proprio on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.pode_acessar('configuracoes/usuarios'))));
create policy avatars_trocar_proprio on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.pode_acessar('configuracoes/usuarios'))));
create policy avatars_excluir_proprio on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.pode_acessar('configuracoes/usuarios'))));
