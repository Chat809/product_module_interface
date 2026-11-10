-- acessos_por_subaba
alter table public.perfis alter column acessos set default '["inicio/dashboard","estoque/produtos","demandas/quadro"]'::jsonb;

update public.perfis p
   set acessos = coalesce((
     select jsonb_agg(distinct nova order by nova)
       from jsonb_array_elements_text(p.acessos) antiga
       cross join lateral unnest(case antiga
         when 'dashboard' then array['inicio/dashboard']
         when 'produtos' then array['estoque/produtos']
         when 'demandas' then array['demandas/quadro']
         when 'financeiro' then array['financeiro/contas-pagar','financeiro/contas-receber','financeiro/fornecedores','financeiro/centros-custo']
         when 'usuarios' then array[]::text[]
         else array[antiga] end) nova
   ), '[]'::jsonb)
 where p.papel <> 'ADMIN' and not p.acessos ? '*';
