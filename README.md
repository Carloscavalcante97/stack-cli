# Create Stack CLI

CLI para iniciar projetos full stack com backend e frontend já estruturados para trabalho real.

O objetivo aqui não é gerar um "hello world bonito". O foco é reduzir tempo de setup sem entregar uma base frágil, acoplada ou difícil de evoluir.

## O que este projeto resolve

Quando um projeto começa do zero, o custo inicial quase sempre cai nas mesmas tarefas:

- definir estrutura de pastas
- configurar ambiente e workspace
- ligar validação e tratamento de erro
- preparar autenticação
- organizar persistência inicial
- subir infraestrutura local
- alinhar uma base mínima de arquitetura

O `create-stack-cli` existe para transformar isso em um ponto de partida consistente, especialmente para:

- projetos pessoais sérios
- protótipos que podem virar produto
- estudos com padrão profissional
- demos técnicas
- times pequenos que querem acelerar o dia zero

## O que o CLI entrega hoje

### Backend

Você pode gerar:

- `NestJS`
- `Express`
- `FastAPI`
- `none`

Os backends gerados saem com base arquitetural organizada, autenticação inicial e endpoints úteis desde o começo.

Dependendo da stack, o scaffold inclui:

- validação de payload
- tratamento de erro
- JWT para autenticação
- rota protegida inicial
- health check
- DI / composition root
- persistência em memória ou PostgreSQL

### Persistência

Quando `postgres` é selecionado:

- `Express` usa `Prisma`
- `Nest` usa `Prisma`
- `FastAPI` usa `SQLAlchemy`

Quando `none` é selecionado:

- o scaffold permanece funcional com repositório em memória

### Frontend

Você pode gerar:

- `Next.js`
- `Vite + React`
- `none`

O frontend sai com:

- estrutura inicial de app
- variáveis de ambiente organizadas
- ponto claro para integração com API
- base visual inicial para continuar o produto

### Infra local

Opcionalmente, o projeto pode sair com:

- `PostgreSQL` via Docker Compose
- `Redis` via Docker Compose

## O que diferencia este CLI de um scaffold raso

- não tenta vender arquitetura só pelo nome das pastas
- já parte de separação de responsabilidades e wiring inicial
- não vem preso a um contexto corporativo específico
- gera código com foco em evolução, não só em demonstração
- reduz retrabalho no primeiro dia sem esconder complexidade real

## Como instalar e usar localmente

### 1. Instalar dependências do próprio CLI

```bash
pnpm install
pnpm build
```

### 2. Expor o binário localmente

```bash
pnpm link --global
hash -r
```

### 3. Executar o CLI

```bash
create-stack
```

O CLI pergunta por:

- nome do projeto
- backend
- frontend
- persistência inicial
- uso de Husky
- Docker Compose
- PostgreSQL local
- Redis local

## Exemplo de uso

```bash
create-stack
```

Exemplo de resultado:

```txt
apps/
  backend/
  frontend/
infra/
  docker/
packages/
```

## Estrutura arquitetural gerada

### Express

Base com:

- `domain`
- `application`
- `infra`
- `presentation`

Composição HTTP explícita, sem controller resolvendo dependência direto no container.

### Nest

Base com:

- módulos por feature
- providers de segurança e persistência separados
- filtro global para erro de aplicação
- testes iniciais de smoke

### FastAPI

Base com:

- `bootstrap`
- `application`
- `domain`
- `infra`
- `presentation`
- `tests`

Com `create_app()`, container, dependencies por request e health split entre `live` e `ready`.

## Endpoints iniciais

Os templates de backend saem com um conjunto mínimo de rotas úteis:

- `GET /api/health` para `Express` e `Nest`
- `GET /api/health/live` para `FastAPI`
- `GET /api/health/ready` para `FastAPI`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/me`

## Fluxo após gerar um projeto

O CLI já imprime os próximos passos no terminal, mas o caminho padrão é:

```bash
cd ~/projects/<nome-do-projeto>
pnpm install
```

Depois:

### Backend Node

```bash
cp apps/backend/.env.example apps/backend/.env
pnpm --filter @apps/backend dev
```

Se o projeto usar PostgreSQL:

```bash
pnpm --filter @apps/backend db:generate
pnpm --filter @apps/backend db:migrate
pnpm --filter @apps/backend dev
```

### Backend FastAPI

```bash
cd apps/backend
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
make test
uvicorn app.main:app --reload --port 3001
```

### Infra local

Se o projeto foi gerado com Docker:

```bash
cp infra/docker/.env.example infra/docker/.env
docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d
```

## Para quem este projeto é

Este repositório é especialmente útil para quem quer:

- começar rápido sem abrir mão de uma base organizada
- publicar projetos com aparência de engenharia real
- evitar copiar sempre o mesmo boilerplate manualmente
- experimentar stacks diferentes mantendo um padrão de entrada

## O que ele não tenta fazer

Este CLI não tenta:

- substituir decisões profundas de domínio
- gerar um produto final
- adivinhar as regras do seu negócio
- impor uma arquitetura única para todos os casos

Ele resolve o setup inicial com um padrão forte e deixa espaço para o projeto crescer de forma consciente.

## Estado atual

Hoje o projeto já é adequado para:

- publicação no GitHub
- demonstração pública
- uso como base para novos projetos

Evoluções naturais que ainda fazem sentido:

- CI inicial por stack
- mais testes gerados
- variantes assíncronas no FastAPI
- módulos mais ricos por contexto de domínio

## Stack do próprio CLI

- `TypeScript`
- `tsx`
- `@inquirer/prompts`
- `chalk`
- `ora`

## Licença

MIT
