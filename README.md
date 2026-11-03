# Painel de Produtos

[![CI](https://github.com/Chat809/product_module_interface/actions/workflows/ci.yml/badge.svg)](https://github.com/Chat809/product_module_interface/actions/workflows/ci.yml)
![Angular](https://img.shields.io/badge/Angular-22-dd0031)
![Angular Material](https://img.shields.io/badge/Angular%20Material-22-3f51b5)
![Testes](https://img.shields.io/badge/testes-26%20passando-success)

Painel administrativo em Angular para gerenciar produtos e estoque. Consome a [Produtos API](https://github.com/Chat809/product_module_api) (Spring Boot), publicada no Render.

## Funcionalidades

- **Dashboard:** indicadores do estoque (produtos, itens, valor total em reais, esgotados e estoque baixo) e a lista "Precisa repor", com atalho para registrar entrada.
- **Busca instantânea:** filtra enquanto você digita, ignora acentos e maiúsculas, aceita vários termos em qualquer ordem e destaca o trecho encontrado. Não faz requisição a cada tecla.
- **Filtros e ordenação:** chips por situação do estoque (todos, disponível, estoque baixo, esgotado) com contagem, ordenação por nome, preço, estoque ou última atualização, e paginação.
- **Cadastro e edição em modal**, no mesmo formulário, com as mesmas regras de validação da API e erros exibidos no campo correspondente. Fechar com alterações pendentes pede confirmação.
- **Movimentações de estoque:** modal de entrada e saída com saldo previsto, aviso de estoque insuficiente e histórico das últimas movimentações.
- **Edição concorrente:** se outra pessoa alterou o produto, a API responde 409; o painel avisa e recarrega os dados.
- **Avisos padronizados:** toasts com emoji por tipo (sucesso, erro, aviso, informação) e botão X para fechar.
- **Modo escuro**, com a preferência salva no navegador (o padrão segue o sistema operacional).
- **Layout responsivo** com menu lateral, que vira menu recolhível no celular.
- Skeleton durante o carregamento, estados vazios e aviso de espera enquanto a API "acorda" no plano gratuito do Render.

## Stack

- Angular 22 (componentes standalone, signals, zoneless, novo control flow e rotas com lazy loading)
- Angular Material 22 (Material 3)
- Reactive Forms
- Vitest (testes unitários)

## Pré-requisitos

- Node.js `^22.22.3` ou `^24.15.0`
- npm

## Como executar

```bash
git clone https://github.com/Chat809/product_module_interface.git
cd product_module_interface
npm install
npm start
```

Acesse `http://localhost:4200`.

Em desenvolvimento, o painel consome a API local em `http://localhost:8080/api/v1`. Para subi-la, siga o README da [Produtos API](https://github.com/Chat809/product_module_api) (`./mvnw spring-boot:run`). A API sobe com 15 produtos de exemplo.

Para usar a API publicada no Render sem rodar o backend localmente:

```bash
npm start -- --configuration production
```

| Ambiente | Arquivo | URL da API |
|---|---|---|
| Desenvolvimento | `src/environments/environment.development.ts` | `http://localhost:8080/api/v1` |
| Produção | `src/environments/environment.ts` | `https://product-module-api.onrender.com/api/v1` |

## Testes

```bash
npm test
```

| Arquivo | O que cobre |
|---|---|
| `produto.service.spec.ts` | URLs, parâmetros, métodos HTTP e corpo de cada operação da API |
| `produto-filtro.spec.ts` | Normalização sem acentos, filtro por termos e situação, ordenação e destaque |
| `produto.store.spec.ts` | Carga única do catálogo e atualização local após cada operação |
| `produto-form.spec.ts` | Validações, cadastro, edição com versão, conflito 409 e erros retornados pela API |
| `toast.spec.ts` | Emoji por tipo, papel de acessibilidade e fechamento pelo botão X |
| `app.spec.ts` | Renderização do layout |

O workflow de CI (`.github/workflows/ci.yml`) roda o build e os testes a cada push e pull request.

## Build

```bash
npm run build
```

Os arquivos são gerados em `dist/product-module-interface/browser`.

## Estrutura

```
src/app
├── app.config.ts             Providers: rotas, HttpClient com interceptor, locale pt-BR e moeda BRL
├── app.routes.ts             Rotas com lazy loading
├── core
│   ├── feedback              Toast padronizado e serviço de notificação
│   ├── http                  Interceptor que traduz os erros da API (RFC 9457) em avisos
│   ├── layout                Shell: barra superior, menu lateral e área de conteúdo
│   └── tema                  Modo claro/escuro
├── shared
│   ├── confirm-dialog        Diálogo de confirmação reutilizável
│   ├── loading               Indicador de carregamento com aviso de partida a frio
│   ├── skeleton              Linhas de carregamento da tabela
│   └── somente-numeros       Diretiva que limita campos a caracteres numéricos
├── dashboard                 Indicadores e lista de reposição
└── produtos
    ├── produto.model.ts      Tipos que espelham os DTOs da API
    ├── produto.service.ts    Comunicação HTTP com a API
    ├── produto.store.ts      Catálogo em memória compartilhado pelas telas
    ├── produto-filtro.ts     Funções puras de busca, filtro, ordenação e destaque
    ├── produto-list          Tabela com busca, filtros, ordenação e paginação
    ├── produto-form          Modal de cadastro e edição
    └── movimentacao-dialog   Modal de entrada/saída com histórico
```

| Rota | Página |
|---|---|
| `/dashboard` | Indicadores e reposição (página inicial) |
| `/produtos` | Lista de produtos |

### Decisões

- **Organização por responsabilidade:** `core` (infraestrutura da aplicação), `shared` (componentes reutilizáveis), `dashboard` e `produtos` (as funcionalidades).
- **Busca em memória:** a API pagina e busca no servidor, mas o painel carrega o catálogo uma vez (até 500 produtos, o maior tamanho de página aceito) e filtra no navegador. Assim a busca responde a cada tecla sem requisições nem espera pela API no plano gratuito. Para catálogos maiores, bastaria trocar o filtro local pelos parâmetros `busca`, `page` e `sort` da API.
- **Store com signals:** um serviço com `signal` e `computed` guarda o catálogo e o atualiza localmente após cadastrar, editar, movimentar ou excluir. Para este escopo, uma biblioteca de estado (como NgRx) seria complexidade sem ganho.
- **Modais em vez de páginas:** cadastrar, editar e movimentar acontecem sem sair da lista, preservando busca, filtros e página.
- **Tratamento de erros centralizado:** o interceptor exibe a mensagem de qualquer erro HTTP; os componentes tratam apenas o que é específico deles, como os erros por campo no formulário.

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. O preset **Angular** é detectado automaticamente. O `vercel.json` já define o comando de build, a pasta de saída e o redirecionamento das rotas para o `index.html`, para que recarregar a página em `/produtos` funcione.
3. Clique em **Deploy**.

A API libera CORS para `https://productmoduleinterface*.vercel.app` e `https://product-module-interface*.vercel.app`. Se o painel for publicado em outro domínio, adicione-o à variável `CORS_ALLOWED_ORIGINS` do serviço da API no Render.

## Links

- Painel publicado: https://productmoduleinterface.vercel.app
- API: https://product-module-api.onrender.com/swagger-ui.html
- Repositório da API: https://github.com/Chat809/product_module_api
