-- url_do_projeto_no_cofre
-- O endereço do projeto fica no cofre (vault), não no código. Em um projeto novo, rode uma vez:
--   select vault.create_secret('https://<ref-do-projeto>.supabase.co', 'url_projeto', 'Endereço do projeto usado pelas tarefas agendadas');
-- Sem esse segredo o despacho de webhooks apenas não roda.

create or replace function public.despachar_webhooks()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'url_projeto' limit 1);
begin
  if v_url is null then
    return;
  end if;
  if exists (select 1 from public.fila_eventos where processado_em is null and proxima_tentativa_em <= now() and tentativas < 3) then
    perform net.http_post(
      url := rtrim(v_url, '/') || '/functions/v1/webhooks-saida',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-fila-token', public.token_da_fila()),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000);
  end if;
end;
$$;
revoke execute on function public.despachar_webhooks() from public, anon, authenticated;
