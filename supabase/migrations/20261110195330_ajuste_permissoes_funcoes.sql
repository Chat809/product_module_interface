-- ajuste_permissoes_funcoes
revoke execute on all functions in schema public from anon;
revoke execute on function public.bloquear_item_comercial(), public.posicionar_participante(), public.validar_rateio(),
  public.bloquear_gasto_em_fatura_fechada(), public.aplicar_desconto_geral(), public.demanda_no_quadro()
from public, authenticated;
revoke all on public.grupos_permissao, public.grupos_permissao_membros from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
grant execute on all functions in schema public to service_role;
