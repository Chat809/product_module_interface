# Painel de Produtos

![Angular](https://img.shields.io/badge/Angular-22-dd0031)
![Angular Material](https://img.shields.io/badge/Angular%20Material-22-3f51b5)
![Testes](https://img.shields.io/badge/testes-11%20passando-success)

Painel administrativo em Angular para gerenciar produtos: listar, buscar, cadastrar, editar e excluir. Consome a [Produtos API](https://github.com/Chat809/product_module_api) (Spring Boot), publicada no Render.

## Funcionalidades

- Listagem em tabela com busca por nome ou descrição e ordenação por nome, preço e estoque.
- Cadastro e edição no mesmo formulário, com as mesmas regras de validação da API e mensagens em português.
- Erros de validação retornados pela API exibidos no campo correspondente.
- Exclusão com diálogo de confirmação e aviso de sucesso.
- Preços formatados em reais (pt-BR).
- Aviso de espera enquanto a API "acorda" no plano gratuito do Render (pode levar até 1 minuto).

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

Em desenvolvimento, o painel consome a API local em `http://localhost:8080/api/v1`. Para subi-la, siga o README da [Produtos API](https://github.com/Chat809/product_module_api) (`./mvnw spring-boot:run`).

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
| `produto.service.spec.ts` | URLs, métodos HTTP e corpo de cada operação da API |
| `produto-form.spec.ts` | Validações, cadastro, edição e exibição dos erros retornados pela API |
| `app.spec.ts` | Renderização do layout |

## Build

```bash
npm run build
```

Os arquivos são gerados em `dist/product-module-interface/browser`.

## Estrutura

```
src/app
├── app.config.ts           Providers: rotas, HttpClient com interceptor, locale pt-BR e moeda BRL
├── app.routes.ts           Rotas com lazy loading
├── core
│   ├── http                Interceptor que exibe os erros da API (RFC 9457) em um aviso
│   └── layout              Shell: barra superior e área de conteúdo
├── shared
│   ├── confirm-dialog      Diálogo de confirmação reutilizável
│   └── loading             Indicador de carregamento com aviso de partida a frio
└── produtos
    ├── produto.model.ts    Tipos que espelham os DTOs da API
    ├── produto.service.ts  Comunicação HTTP com a API
    ├── produto-list        Página do painel (tabela, busca, ordenação e exclusão)
    └── produto-form        Página de cadastro e edição
```

| Rota | Página |
|---|---|
| `/produtos` | Lista de produtos |
| `/produtos/novo` | Cadastro |
| `/produtos/:id/editar` | Edição |

### Decisões

- **Organização por responsabilidade:** `core` (infraestrutura da aplicação), `shared` (componentes reutilizáveis) e `produtos` (a funcionalidade). Uma nova funcionalidade entra como uma nova pasta, ao lado de `produtos`.
- **Estado local com signals:** cada página mantém seu próprio estado com `signal` e `computed`. Para este escopo, uma biblioteca de estado (como NgRx) seria complexidade sem ganho.
- **Busca e ordenação no cliente:** a API retorna a lista completa, então filtrar e ordenar no navegador evita requisições extras.
- **Tratamento de erros centralizado:** o interceptor exibe a mensagem de qualquer erro HTTP; as páginas tratam apenas o que é específico delas, como os erros por campo no formulário.

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. O preset **Angular** é detectado automaticamente. O `vercel.json` já define o comando de build, a pasta de saída e o redirecionamento das rotas para o `index.html`, para que recarregar a página em `/produtos/1/editar` funcione.
3. Clique em **Deploy**.

A API libera CORS para `https://product-module-interface*.vercel.app`. Se o painel for publicado em outro domínio, adicione-o à variável `CORS_ALLOWED_ORIGINS` do serviço da API no Render.

## Links

- Painel publicado: _link a ser adicionado após o deploy._
- API: https://product-module-api.onrender.com/swagger-ui.html
- Repositório da API: https://github.com/Chat809/product_module_api
