-- criar_perfis
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 100),
  email text not null unique,
  papel text not null default 'USUARIO' check (papel in ('ADMIN', 'USUARIO')),
  criado_em timestamptz not null default now()
);

comment on table public.perfis is 'Dados publicos e papel de cada usuario do Auth. Acessada somente pelo backend com a chave secreta.';

create index perfis_nome_idx on public.perfis (nome);

alter table public.perfis enable row level security;
revoke all on table public.perfis from anon, authenticated;

-- Cria o perfil (papel USUARIO) sempre que um usuario e criado no Auth.
create function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_do_usuario();

-- Copia o papel para o app_metadata, que vai no JWT e nao pode ser alterado pelo proprio usuario.
create function public.sincronizar_papel_no_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('papel', new.papel)
   where id = new.id;
  return new;
end;
$$;

create trigger ao_definir_papel
  after insert or update of papel on public.perfis
  for each row execute function public.sincronizar_papel_no_token();

revoke execute on function public.criar_perfil_do_usuario() from public, anon, authenticated;
revoke execute on function public.sincronizar_papel_no_token() from public, anon, authenticated;
