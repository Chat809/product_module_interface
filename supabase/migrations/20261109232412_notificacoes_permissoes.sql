-- notificacoes_permissoes
grant execute on function public.tem_subaba(uuid, text), public.notificar(uuid, text, text, text, text, text) to service_role;
