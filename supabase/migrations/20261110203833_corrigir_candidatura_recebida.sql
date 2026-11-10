create or replace function public.candidatura_recebida()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r record;
begin
  select va.titulo, va.responsavel_id, pc.nome into r
    from public.vagas_emprego va, public.pessoas_candidatas pc
   where va.id = new.vaga_id and pc.id = new.pessoa_id;
  perform public.notificar(r.responsavel_id, 'CANDIDATURA_RECEBIDA', left('Nova candidatura: ' || r.titulo, 150),
    left(r.nome || ' se candidatou.', 500), '/rh/vagas', 'candidatura:' || new.id);
  perform public.enfileirar_evento('candidatura.recebida', to_jsonb(new));
  return null;
end;
$function$;
