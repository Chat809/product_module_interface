-- Ajustes por cliente. Rode depois das migrações, trocando os valores entre <>.
-- As migrações já criam plano de contas, listas, numeração, quadro "Geral" e parâmetros padrão.

-- 1) Endereço do projeto (usado pelo despacho de webhooks)
-- select vault.create_secret('https://<ref-do-projeto>.supabase.co', 'url_projeto', 'Endereço do projeto usado pelas tarefas agendadas');

-- 2) Marca e dados da empresa
update public.parametros_sistema
   set valor = valor || '{"nome":"<Nome da empresa>","nome_curto":"<Sigla>","cor_primaria":"#2e7d32","cor_secundaria":"#8d6e63"}'::jsonb
 where chave = 'marca';

update public.parametros_sistema
   set valor = valor || '{"razao_social":"<Razão social>","documento":"<CNPJ>","email":"<contato@empresa.com>","telefone":"<telefone>"}'::jsonb
 where chave = 'empresa';

-- 3) Módulos contratados (desligue o que o cliente não usa)
-- update public.modulos_ativos set ativo = false where modulo in ('rh', 'comercial');

-- 4) Primeiro administrador: crie a conta pela tela de cadastro e depois promova
-- update public.perfis set papel = 'ADMIN' where email = '<email-do-admin>';
