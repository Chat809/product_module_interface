revoke execute on function public.faturar_pedido(uuid, integer, date, text, uuid) from public, anon;
revoke execute on function public.fechar_fatura(uuid) from public, anon;
revoke execute on function public.projecao_caixa(date, date) from public, anon;
revoke execute on function public.ranking_comercial(date) from public, anon;
grant execute on function public.faturar_pedido(uuid, integer, date, text, uuid) to authenticated;
grant execute on function public.fechar_fatura(uuid) to authenticated;
grant execute on function public.projecao_caixa(date, date) to authenticated;
grant execute on function public.ranking_comercial(date) to authenticated;
