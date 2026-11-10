-- ajustes_desempenho
drop policy parametros_gravar on public.parametros_sistema;
create policy parametros_incluir on public.parametros_sistema for insert to authenticated with check ((select public.pode_acessar('configuracoes/sistema')));
create policy parametros_alterar on public.parametros_sistema for update to authenticated
  using ((select public.pode_acessar('configuracoes/sistema'))) with check ((select public.pode_acessar('configuracoes/sistema')));
create policy parametros_excluir on public.parametros_sistema for delete to authenticated using ((select public.pode_acessar('configuracoes/sistema')));

drop policy modulos_gravar on public.modulos_ativos;
create policy modulos_incluir on public.modulos_ativos for insert to authenticated with check ((select public.pode_acessar('configuracoes/sistema')));
create policy modulos_alterar on public.modulos_ativos for update to authenticated
  using ((select public.pode_acessar('configuracoes/sistema'))) with check ((select public.pode_acessar('configuracoes/sistema')));
create policy modulos_excluir on public.modulos_ativos for delete to authenticated using ((select public.pode_acessar('configuracoes/sistema')));

create index if not exists gastos_cartao_cartao on public.gastos_cartao (cartao_id, data);
create index if not exists comissoes_pedido on public.comissoes_apuradas (pedido_id);
create index if not exists candidaturas_pessoa on public.candidaturas_vaga (pessoa_id);
create index if not exists jornada_participantes_cliente on public.jornada_participantes (cliente_id);
create index if not exists leads_cliente on public.leads (cliente_id);
create index if not exists leads_origem on public.leads (origem_id);
create index if not exists demandas_quadro on public.demandas (quadro_id);
create index if not exists clientes_responsavel on public.clientes (responsavel_id);
create index if not exists compromissos_responsavel on public.compromissos_agenda (responsavel_id, inicio);
create index if not exists compromissos_cliente on public.compromissos_agenda (cliente_id);
create index if not exists contas_pagar_conta_bancaria on public.contas_pagar (conta_bancaria_id);
create index if not exists contas_receber_conta_bancaria on public.contas_receber (conta_bancaria_id);
create index if not exists contas_pagar_plano on public.contas_pagar (plano_conta_id);
create index if not exists contas_receber_plano on public.contas_receber (plano_conta_id);
create index if not exists pedidos_responsavel on public.pedidos_venda (responsavel_id, faturado_em);
create index if not exists propostas_lead on public.propostas_comerciais (lead_id);
create index if not exists tabela_preco_itens_produto on public.tabela_preco_itens (produto_id);
