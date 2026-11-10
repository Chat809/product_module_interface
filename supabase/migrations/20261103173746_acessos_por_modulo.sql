-- acessos_por_modulo
alter table public.perfis
  add column if not exists acessos jsonb not null default '["dashboard","produtos"]'::jsonb;

alter table public.perfis
  add constraint perfis_acessos_validos check (
    jsonb_typeof(acessos) = 'array'
    and acessos <@ '["*","dashboard","produtos","usuarios"]'::jsonb
    and (papel = 'ADMIN' or not acessos ? 'usuarios')
  );

create or replace function public.admin_tem_acesso_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.papel = 'ADMIN' then
    new.acessos := '["*"]'::jsonb;
  end if;
  return new;
end;
$$;

revoke execute on function public.admin_tem_acesso_total() from public, anon, authenticated;

drop trigger if exists ao_salvar_acessos on public.perfis;
create trigger ao_salvar_acessos
  before insert or update of papel, acessos on public.perfis
  for each row execute function public.admin_tem_acesso_total();

create or replace function public.sincronizar_papel_no_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('papel', new.papel, 'acessos', new.acessos)
   where id = new.id;
  return new;
end;
$$;

revoke execute on function public.sincronizar_papel_no_token() from public, anon, authenticated;

drop trigger if exists ao_definir_papel on public.perfis;
create trigger ao_definir_papel
  after insert or update of papel, acessos on public.perfis
  for each row execute function public.sincronizar_papel_no_token();

update public.perfis set acessos = '["*"]'::jsonb where papel = 'ADMIN';
update public.perfis set acessos = acessos where papel <> 'ADMIN';
