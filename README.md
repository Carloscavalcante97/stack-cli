# Create Stack CLI

Scaffold CLI para acelerar o início de projetos full stack com uma base mais próxima de produção.

Tagline: gere projetos com Express, Nest ou FastAPI já com validação, DI, JWT e PostgreSQL opcional.

## Por que esse projeto existe

Começar um projeto do zero quase sempre custa tempo demais em tarefas repetidas:

- organizar estrutura inicial
- configurar backend e frontend
- ligar validação
- preparar autenticação
- decidir convenções mínimas
- subir infraestrutura local

O objetivo do `create-stack-cli` é reduzir esse tempo e entregar uma base limpa, genérica e reutilizável para quem quer começar rápido sem abrir mão de uma arquitetura sólida.

## O que ele gera

### Backend

Escolha entre:

- `NestJS`
- `Express`
- `FastAPI`
- `none`

Todos os backends gerados saem com:

- organização em camadas inspirada em clean architecture
- validação de entrada
- JWT para autenticação
- rota protegida inicial
- health check
- DI configurada na stack
- PostgreSQL opcional

### ORM e persistência

Quando `postgres` é selecionado:

- `Express` usa `Prisma`
- `Nest` usa `Prisma`
- `FastAPI` usa `SQLAlchemy`

Quando `none` é selecionado:

- o scaffold usa um repositório em memória para continuar funcional

### Frontend

Escolha entre:

- `Next.js`
- `Vite + React`
- `none`

O frontend sai com:

- shell visual inicial
- env centralizado
- estrutura pronta para conectar API
- base genérica para evoluir autenticação e design system depois

### Infra local

Opcionalmente:

- `PostgreSQL` via Docker Compose
- `Redis` via Docker Compose

## Estrutura que o CLI cria

```txt
apps/
  backend/
  frontend/
infra/
  docker/
packages/
```

No backend, a base segue este desenho:

```txt
src/
  domain/
  application/
  infra/
  presentation/
  shared/
```

## Exemplo de fluxo

```bash
pnpm install
pnpm build
node dist/index.js
```

Durante a execução, o CLI pergunta:

- nome do projeto
- backend desejado
- frontend desejado
- persistência inicial
- uso de Husky
- Docker Compose
- PostgreSQL local
- Redis local

## Exemplo do que já nasce pronto

### Express / Nest / FastAPI

Endpoints iniciais:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/me`

### Frontend

Variáveis iniciais:

- `NEXT_PUBLIC_API_URL` ou `VITE_API_URL`
- `NEXT_PUBLIC_DATA_LAYER` ou `VITE_DATA_LAYER`

## Diferenciais do projeto

- evita scaffold extremamente raso
- não está preso a um contexto de empresa específico
- serve como base genérica para portfólio, estudo e projetos reais
- acelera onboarding de times pequenos
- reduz o tempo até a primeira feature útil

## Stack usada no CLI

- `TypeScript`
- `tsx`
- `@inquirer/prompts`
- `chalk`
- `ora`

## Como posicionar esse projeto

Você pode apresentar o `create-stack-cli` como:

- um scaffold full stack com foco em velocidade + base de engenharia
- uma CLI para iniciar APIs com arquitetura organizada desde o dia zero
- uma ferramenta para reduzir tempo perdido com setup repetitivo

## Roadmap sugerido

- adicionar testes base por stack
- gerar módulos por contexto de domínio
- oferecer opção de lint por app
- gerar CI inicial para GitHub Actions
- criar templates de documentação por projeto

## Status

O projeto está pronto para demonstração pública e publicação no GitHub/LinkedIn como uma ferramenta de produtividade para início de projetos.
