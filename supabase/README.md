# Banco e funções (Supabase)

Tudo o que o painel precisa no Supabase está versionado aqui. O painel conversa direto com o banco
(supabase-js + RLS); as Edge Functions cuidam só do que exige a chave do servidor ou é público.

```
supabase/
  migrations/   esquema completo, em ordem (tabelas, RLS, funções, gatilhos e tarefas agendadas)
  functions/    Edge Functions
  seed.sql      ajustes por cliente (marca, empresa, módulos, primeiro admin)
```

## Novo cliente

1. Crie um projeto no Supabase e anote a URL e a chave publicável (`sb_publishable_...`).
2. Aplique as migrações em ordem. Com a CLI: `supabase link --project-ref <ref>` e `supabase db push`.
   Sem a CLI, cole cada arquivo de `migrations/` no SQL Editor, do mais antigo para o mais novo.
3. Grave a URL do projeto no cofre (usada pelo despacho de webhooks):
   `select vault.create_secret('https://<ref>.supabase.co', 'url_projeto');`
4. Publique as funções: `supabase functions deploy admin-usuarios status-integracoes` e
   `supabase functions deploy webhooks-saida webhooks-entrada formulario-publico --no-verify-jwt`.
5. Em Authentication, ligue o provedor Google se o cliente for usar, e cadastre a URL do painel em Redirect URLs.
6. Rode `seed.sql` com os dados do cliente e promova o primeiro administrador.
7. No painel, preencha `src/environments/environment*.ts` com a URL e a chave publicável.

## Permissões

- Toda tabela tem RLS. A função `pode_acessar('modulo/subaba')` decide quem lê e quem grava, somando os
  acessos do perfil e dos grupos de permissão (`grupos_permissao`). Administradores podem tudo.
- Os acessos efetivos também vão para o token (`app_metadata.acessos`), que o painel usa para montar o menu.
- Visitantes sem login só leem `parametros_sistema` públicos, `modulos_ativos` e vagas públicas abertas.

## Edge Functions

| Função | Login | Para quê |
| --- | --- | --- |
| `admin-usuarios` | sim | criar, alterar, redefinir senha e excluir usuários |
| `status-integracoes` | sim | situação de Supabase, Google, e-mail, webhooks e tarefas agendadas |
| `webhooks-saida` | não (token interno) | entrega a `fila_eventos` assinando com `X-Tribo-Assinatura: sha256=...`; até 3 tentativas |
| `webhooks-entrada` | não (token na URL) | recebe leads de outros sistemas (JSON até 16 KB, aceita UTM) |
| `formulario-publico` | não (token do link) | páginas `/p/:token` e `/trabalhe-conosco` |

O `pg_cron` chama `webhooks-saida` a cada minuto quando há eventos pendentes, usando um token guardado no cofre.

## Tarefas agendadas

`notificar-vencimentos`, `gerar-recorrencias`, `processar-jornadas`, `lembrar-compromissos`,
`despachar-webhooks` e as limpezas de entregas, fila e trilha de auditoria (12 meses).
