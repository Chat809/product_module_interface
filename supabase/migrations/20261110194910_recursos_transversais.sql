-- recursos_transversais
-- Qual subaba responde por cada entidade
create or replace function public.chave_da_entidade(p_entidade text)
returns text language sql immutable set search_path = '' as $$
  select case p_entidade
    when 'clientes' then 'crm/clientes'
    when 'leads' then 'crm/leads'
    when 'reclamacoes' then 'crm/reclamacoes'
    when 'crm_etapas' then 'configuracoes/parametros-crm'
    when 'crm_origens' then 'configuracoes/parametros-crm'
    when 'pesquisas_satisfacao' then 'crm/pesquisas'
    when 'jornadas_relacionamento' then 'crm/jornadas'
    when 'produtos' then 'estoque/produtos'
    when 'demandas' then 'demandas/quadro'
    when 'roteiros_checklist' then 'demandas/roteiros'
    when 'compromissos_agenda' then 'demandas/agenda'
    when 'contas_pagar' then 'financeiro/contas-pagar'
    when 'contas_receber' then 'financeiro/contas-receber'
    when 'fornecedores' then 'financeiro/fornecedores'
    when 'centros_custo' then 'financeiro/centros-custo'
    when 'contas_bancarias' then 'financeiro/contas-bancarias'
    when 'lancamentos_caixa' then 'financeiro/fluxo-caixa'
    when 'plano_contas' then 'financeiro/plano-contas'
    when 'gastos_cartao' then 'financeiro/cartoes'
    when 'faturas_cartao_corporativo' then 'financeiro/cartoes'
    when 'creditos_cliente' then 'financeiro/creditos'
    when 'propostas_comerciais' then 'comercial/propostas'
    when 'pedidos_venda' then 'comercial/pedidos'
    when 'tabelas_preco' then 'comercial/tabelas-preco'
    when 'vagas_emprego' then 'rh/vagas'
    when 'pessoas_candidatas' then 'rh/candidatos'
    when 'perfis' then 'configuracoes/usuarios'
    when 'parametros_sistema' then 'configuracoes/sistema'
    when 'modulos_ativos' then 'configuracoes/sistema'
    when 'grupos_permissao' then 'configuracoes/grupos'
    when 'grupos_permissao_membros' then 'configuracoes/grupos'
    else 'configuracoes/auditoria' end
$$;
grant execute on function public.chave_da_entidade(text) to authenticated;

-- Anexos
create table public.arquivos_vinculados (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade ~ '^[a-z_]{2,40}$'),
  registro_id uuid not null,
  caminho text not null unique check (char_length(caminho) <= 400),
  nome_original text not null check (char_length(nome_original) between 1 and 200),
  tipo_mime text check (char_length(tipo_mime) <= 120),
  tamanho_bytes bigint check (tamanho_bytes >= 0),
  enviado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index arquivos_vinculados_registro on public.arquivos_vinculados (entidade, registro_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', false, 10485760)
on conflict (id) do nothing;

create policy arquivos_ler on storage.objects for select to authenticated
  using (bucket_id = 'arquivos' and public.pode_acessar(public.chave_da_entidade((storage.foldername(name))[1])));
create policy arquivos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'arquivos' and public.pode_acessar(public.chave_da_entidade((storage.foldername(name))[1])));
create policy arquivos_excluir on storage.objects for delete to authenticated
  using (bucket_id = 'arquivos' and public.pode_acessar(public.chave_da_entidade((storage.foldername(name))[1])));

-- Trilha de auditoria
create table public.trilha_auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text,
  acao text not null check (acao in ('CRIACAO','ALTERACAO','EXCLUSAO')),
  alteracoes jsonb,
  usuario_id uuid,
  criado_em timestamptz not null default now()
);
create index trilha_auditoria_registro on public.trilha_auditoria (tabela, registro_id, criado_em desc);
create index trilha_auditoria_data on public.trilha_auditoria (criado_em desc);

create or replace function public.registrar_auditoria()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_ref jsonb := coalesce(v_new, v_old);
  v_id text := coalesce(v_ref ->> 'id', v_ref ->> 'chave', v_ref ->> 'modulo',
                        (v_ref ->> 'grupo_id') || '/' || (v_ref ->> 'usuario_id'));
  v_diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('de', v_old -> k, 'para', v_new -> k))
      into v_diff
      from jsonb_object_keys(v_new) k
     where k not in ('atualizado_em', 'versao', 'ordem', 'atualizado_por')
       and (v_new -> k) is distinct from (v_old -> k);
    if v_diff is null then
      return null;
    end if;
  elsif tg_op = 'DELETE' then
    v_diff := v_old;
  end if;
  insert into public.trilha_auditoria (tabela, registro_id, acao, alteracoes, usuario_id)
  values (tg_table_name, v_id,
          case tg_op when 'INSERT' then 'CRIACAO' when 'UPDATE' then 'ALTERACAO' else 'EXCLUSAO' end,
          v_diff, (select auth.uid()));
  return null;
end;
$$;
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['clientes','leads','produtos','fornecedores','centros_custo','contas_pagar','contas_receber',
                           'reclamacoes','demandas','perfis','crm_etapas','crm_origens','parametros_sistema',
                           'modulos_ativos','grupos_permissao','grupos_permissao_membros'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t || '_auditoria', t);
  end loop;
end $$;

select cron.schedule('limpar-trilha-auditoria', '15 6 * * *',
  $$delete from public.trilha_auditoria where criado_em < now() - interval '1 year'$$);

-- Marcadores (etiquetas livres em qualquer registro)
create table public.marcadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 1 and 40),
  cor text not null default '#607d8b' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  criado_em timestamptz not null default now()
);
create table public.marcadores_vinculos (
  marcador_id uuid not null references public.marcadores(id) on delete cascade,
  entidade text not null check (entidade ~ '^[a-z_]{2,40}$'),
  registro_id uuid not null,
  criado_em timestamptz not null default now(),
  primary key (marcador_id, entidade, registro_id)
);
create index marcadores_vinculos_registro on public.marcadores_vinculos (entidade, registro_id);

-- Links publicos (formularios, pesquisas, propostas, vagas)
create table public.links_publicos (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  tipo text not null check (tipo in ('FORMULARIO_LEAD','PESQUISA_SATISFACAO','PROPOSTA','VAGA')),
  entidade text check (entidade ~ '^[a-z_]{2,40}$'),
  registro_id uuid,
  titulo text not null check (char_length(btrim(titulo)) between 2 and 120),
  configuracao jsonb not null default '{}'::jsonb check (jsonb_typeof(configuracao) = 'object'),
  expira_em timestamptz,
  usos_maximos integer check (usos_maximos > 0),
  usos integer not null default 0,
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

create or replace function public.chave_do_link(p_tipo text)
returns text language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'FORMULARIO_LEAD' then 'crm/leads'
    when 'PESQUISA_SATISFACAO' then 'crm/pesquisas'
    when 'PROPOSTA' then 'comercial/propostas'
    when 'VAGA' then 'rh/vagas'
  end
$$;
grant execute on function public.chave_do_link(text) to authenticated;

-- Modelos e historico de comunicacao
create table public.modelos_comunicacao (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(btrim(nome)) between 2 and 80),
  canal text not null default 'EMAIL' check (canal in ('EMAIL','WHATSAPP','SMS')),
  entidade text check (entidade ~ '^[a-z_]{2,40}$'),
  assunto text check (char_length(assunto) <= 150),
  corpo text not null check (char_length(corpo) between 1 and 10000),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger modelos_comunicacao_atualizado_em before update on public.modelos_comunicacao
  for each row execute function public.tocar_atualizado_em();

create table public.comunicacoes_enviadas (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid references public.modelos_comunicacao(id) on delete set null,
  canal text not null check (canal in ('EMAIL','WHATSAPP','SMS')),
  destinatario text not null check (char_length(destinatario) between 3 and 254),
  assunto text check (char_length(assunto) <= 150),
  corpo text not null check (char_length(corpo) <= 10000),
  entidade text not null check (entidade ~ '^[a-z_]{2,40}$'),
  registro_id uuid not null,
  status text not null default 'REGISTRADA' check (status in ('REGISTRADA','PENDENTE','ENVIADA','FALHOU')),
  erro text check (char_length(erro) <= 500),
  enviado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index comunicacoes_enviadas_registro on public.comunicacoes_enviadas (entidade, registro_id, criado_em desc);

-- Fila de eventos para webhooks de saida
create table public.fila_eventos (
  id bigint generated always as identity primary key,
  evento text not null,
  payload jsonb not null default '{}'::jsonb,
  tentativas integer not null default 0,
  proxima_tentativa_em timestamptz not null default now(),
  processado_em timestamptz,
  erro text,
  criado_em timestamptz not null default now()
);
create index fila_eventos_pendentes on public.fila_eventos (proxima_tentativa_em) where processado_em is null;

create or replace function public.eventos_webhook()
returns text[] language sql immutable set search_path = '' as $$
  select array['cliente.criado','lead.criado','lead.etapa_alterada','lead.convertido',
               'reclamacao.aberta','reclamacao.status_alterado','conta.paga','conta.recebida',
               'produto.estoque_baixo','proposta.aprovada','pedido.faturado',
               'candidatura.recebida','satisfacao.respondida']
$$;
grant execute on function public.eventos_webhook() to authenticated;
alter table public.webhooks_saida drop constraint webhooks_saida_eventos_check;
alter table public.webhooks_saida add constraint webhooks_saida_eventos_check
  check (cardinality(eventos) > 0 and eventos <@ public.eventos_webhook());

create or replace function public.enfileirar_evento(p_evento text, p_dados jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.webhooks_saida where ativo and p_evento = any(eventos)) then
    insert into public.fila_eventos (evento, payload) values (p_evento, coalesce(p_dados, '{}'::jsonb));
  end if;
end;
$$;
revoke execute on function public.enfileirar_evento(text, jsonb) from public, anon, authenticated;

insert into public.parametros_sistema (chave, valor, descricao)
values ('estoque', '{"limite_baixo":5}', 'Saldo a partir do qual o produto conta como estoque baixo')
on conflict (chave) do nothing;

create or replace function public.eventos_de_negocio()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limite integer;
begin
  case tg_table_name
  when 'clientes' then
    perform public.enfileirar_evento('cliente.criado', to_jsonb(new));
  when 'leads' then
    if tg_op = 'INSERT' then
      perform public.enfileirar_evento('lead.criado', to_jsonb(new));
    else
      if new.etapa_id is distinct from old.etapa_id then
        perform public.enfileirar_evento('lead.etapa_alterada', to_jsonb(new));
      end if;
      if old.cliente_id is null and new.cliente_id is not null then
        perform public.enfileirar_evento('lead.convertido', to_jsonb(new));
      end if;
    end if;
  when 'reclamacoes' then
    if tg_op = 'INSERT' then
      perform public.enfileirar_evento('reclamacao.aberta', to_jsonb(new));
    elsif new.status is distinct from old.status then
      perform public.enfileirar_evento('reclamacao.status_alterado', to_jsonb(new));
    end if;
  when 'contas_pagar' then
    if new.status = 'PAGO' and old.status is distinct from 'PAGO' then
      perform public.enfileirar_evento('conta.paga', jsonb_build_object('tipo', 'contas-pagar', 'conta', to_jsonb(new)));
    end if;
  when 'contas_receber' then
    if new.status = 'RECEBIDO' and old.status is distinct from 'RECEBIDO' then
      perform public.enfileirar_evento('conta.recebida', jsonb_build_object('tipo', 'contas-receber', 'conta', to_jsonb(new)));
    end if;
  when 'movimentacoes_estoque' then
    select coalesce((valor ->> 'limite_baixo')::integer, 5) into v_limite from public.parametros_sistema where chave = 'estoque';
    if new.tipo = 'SAIDA' and new.saldo_apos <= coalesce(v_limite, 5) then
      perform public.enfileirar_evento('produto.estoque_baixo',
        jsonb_build_object('produto', (select to_jsonb(p) from public.produtos p where p.id = new.produto_id),
                           'saldo', new.saldo_apos));
    end if;
  else
    null;
  end case;
  return null;
end;
$$;
revoke execute on function public.eventos_de_negocio() from public, anon, authenticated;

create trigger clientes_eventos after insert on public.clientes for each row execute function public.eventos_de_negocio();
create trigger leads_eventos after insert or update of etapa_id, cliente_id on public.leads for each row execute function public.eventos_de_negocio();
create trigger reclamacoes_eventos after insert or update of status on public.reclamacoes for each row execute function public.eventos_de_negocio();
create trigger contas_pagar_eventos after update of status on public.contas_pagar for each row execute function public.eventos_de_negocio();
create trigger contas_receber_eventos after update of status on public.contas_receber for each row execute function public.eventos_de_negocio();
create trigger movimentacoes_eventos after insert on public.movimentacoes_estoque for each row execute function public.eventos_de_negocio();

select cron.schedule('limpar-fila-eventos', '45 6 * * *',
  $$delete from public.fila_eventos where processado_em < now() - interval '30 days'$$);

-- RLS
alter table public.arquivos_vinculados enable row level security;
alter table public.trilha_auditoria enable row level security;
alter table public.marcadores enable row level security;
alter table public.marcadores_vinculos enable row level security;
alter table public.links_publicos enable row level security;
alter table public.modelos_comunicacao enable row level security;
alter table public.comunicacoes_enviadas enable row level security;
alter table public.fila_eventos enable row level security;

create policy arquivos_vinculados_ler on public.arquivos_vinculados for select to authenticated
  using (public.pode_acessar(public.chave_da_entidade(entidade)));
create policy arquivos_vinculados_incluir on public.arquivos_vinculados for insert to authenticated
  with check (public.pode_acessar(public.chave_da_entidade(entidade)));
create policy arquivos_vinculados_excluir on public.arquivos_vinculados for delete to authenticated
  using (public.pode_acessar(public.chave_da_entidade(entidade)));
grant select, insert, delete on public.arquivos_vinculados to authenticated;

create policy trilha_ler on public.trilha_auditoria for select to authenticated
  using ((select public.pode_acessar('configuracoes/auditoria')) or public.pode_acessar(public.chave_da_entidade(tabela)));
grant select on public.trilha_auditoria to authenticated;

create policy marcadores_ler on public.marcadores for select to authenticated using (true);
create policy marcadores_incluir on public.marcadores for insert to authenticated with check (true);
create policy marcadores_alterar on public.marcadores for update to authenticated
  using ((select public.pode_acessar('configuracoes/listas'))) with check ((select public.pode_acessar('configuracoes/listas')));
create policy marcadores_excluir on public.marcadores for delete to authenticated
  using ((select public.pode_acessar('configuracoes/listas')));
grant select, insert, update, delete on public.marcadores to authenticated;

create policy marcadores_vinculos_ler on public.marcadores_vinculos for select to authenticated
  using (public.pode_acessar(public.chave_da_entidade(entidade)));
create policy marcadores_vinculos_incluir on public.marcadores_vinculos for insert to authenticated
  with check (public.pode_acessar(public.chave_da_entidade(entidade)));
create policy marcadores_vinculos_excluir on public.marcadores_vinculos for delete to authenticated
  using (public.pode_acessar(public.chave_da_entidade(entidade)));
grant select, insert, delete on public.marcadores_vinculos to authenticated;

create policy links_publicos_ler on public.links_publicos for select to authenticated
  using (public.pode_acessar(public.chave_do_link(tipo)));
create policy links_publicos_incluir on public.links_publicos for insert to authenticated
  with check (public.pode_acessar(public.chave_do_link(tipo)));
create policy links_publicos_alterar on public.links_publicos for update to authenticated
  using (public.pode_acessar(public.chave_do_link(tipo))) with check (public.pode_acessar(public.chave_do_link(tipo)));
create policy links_publicos_excluir on public.links_publicos for delete to authenticated
  using (public.pode_acessar(public.chave_do_link(tipo)));
grant select, insert, delete on public.links_publicos to authenticated;
grant update (titulo, configuracao, expira_em, usos_maximos, ativo) on public.links_publicos to authenticated;

create policy modelos_ler on public.modelos_comunicacao for select to authenticated using (true);
create policy modelos_incluir on public.modelos_comunicacao for insert to authenticated
  with check ((select public.pode_acessar('configuracoes/modelos-comunicacao')));
create policy modelos_alterar on public.modelos_comunicacao for update to authenticated
  using ((select public.pode_acessar('configuracoes/modelos-comunicacao'))) with check ((select public.pode_acessar('configuracoes/modelos-comunicacao')));
create policy modelos_excluir on public.modelos_comunicacao for delete to authenticated
  using ((select public.pode_acessar('configuracoes/modelos-comunicacao')));
grant select, insert, update, delete on public.modelos_comunicacao to authenticated;

create policy comunicacoes_ler on public.comunicacoes_enviadas for select to authenticated
  using (public.pode_acessar(public.chave_da_entidade(entidade)));
create policy comunicacoes_incluir on public.comunicacoes_enviadas for insert to authenticated
  with check (public.pode_acessar(public.chave_da_entidade(entidade)));
grant select, insert on public.comunicacoes_enviadas to authenticated;
