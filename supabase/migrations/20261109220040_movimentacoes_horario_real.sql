-- movimentacoes_horario_real
alter table public.movimentacoes_estoque alter column criado_em set default clock_timestamp();
