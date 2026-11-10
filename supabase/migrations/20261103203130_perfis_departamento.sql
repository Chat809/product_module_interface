-- perfis_departamento
alter table public.perfis add column if not exists departamento text
  check (departamento is null or char_length(departamento) <= 80);
comment on column public.perfis.departamento is 'Departamento da pessoa; definido pelo administrador.';
comment on column public.perfis.funcao is 'Cargo da pessoa; definido pelo administrador.';
