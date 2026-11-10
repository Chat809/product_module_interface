# Personalização por cliente

Este painel é uma base reutilizável. Cada cliente ganha um fork próprio, com o próprio projeto Supabase, e
continua recebendo as melhorias da base pelo remoto `upstream`.

## Criar o repositório de um cliente

```bash
git clone https://github.com/<conta>/<repo-do-cliente>.git
cd <repo-do-cliente>
git remote add upstream https://github.com/Chat809/product_module_interface.git
git fetch upstream
git merge upstream/main          # primeira carga da base
git push origin main
```

Depois prepare o banco seguindo `supabase/README.md` e aponte `src/environments/environment*.ts` para o
projeto do cliente (URL e chave publicável `sb_publishable_...`).

## O que mudar e onde

| O quê | Onde |
| --- | --- |
| Nome, nome curto, logo, favicon e cores | tabela `parametros_sistema`, chave `marca` (tela Configurações › Marca e módulos) |
| Módulos ligados no menu | tabela `modulos_ativos` (mesma tela) |
| Campos a mais em clientes, leads, produtos etc. | Configurações › Campos extras (coluna `extras`) |
| Listas de opções, numeração de documentos | Configurações › Listas auxiliares e Numeração |
| Telas exclusivas do cliente | esta pasta: `CLIENTE.modulosExtras` e `CLIENTE.rotasExtras` em `cliente.ts` |

Regras para o fork receber atualizações sem conflito:

- Código exclusivo do cliente fica em `src/app/cliente/` e em migrações novas com prefixo de data posterior às da base.
- Não edite arquivos da base para personalizar: use os parâmetros do banco ou esta pasta. Se precisar mudar a base,
  faça a mudança no repositório da base e traga com `git merge upstream/main`.
- Tabelas exclusivas do cliente precisam de RLS com `pode_acessar('<modulo>/<subaba>')`, usando as mesmas chaves
  declaradas em `modulosExtras`.

## Atualizar um cliente com a base

```bash
git fetch upstream
git merge upstream/main
# aplique no Supabase do cliente as migrações novas de supabase/migrations
git push origin main
```
