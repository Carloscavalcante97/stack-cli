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

### Autenticação

- `JWT próprio`: cadastro, login e senha no backend (bcrypt + JWT assinado com segredo gerado na hora)
- `Firebase Auth`: login no frontend com o SDK do Firebase (e-mail/senha e Google); o backend só verifica o ID token com o Admin SDK

Com Firebase:

- os backends não têm `register`/`login`; `GET /api/users/me` cria o usuário local (id = UID do Firebase) no primeiro acesso
- no Nest, um guard global protege tudo por padrão e `@Public()` libera rotas (o health já vem liberado); `@CurrentUser()` entrega o usuário do token
- Next e Vite saem com `AuthProvider`/`useAuth()`, ações `login`/`register`/`loginWithGoogle`/`logout` e um `apiFetch` que envia o ID token para a API
- Node verifica token só com `FIREBASE_PROJECT_ID`; o SDK Python exige credencial (`GOOGLE_APPLICATION_CREDENTIALS`) fora do GCP
- dá para desenvolver sem projeto real com o emulador: `firebase emulators:start --only auth --project demo-app` na raiz do projeto gerado

### Infra local

Com PostgreSQL, o projeto pode sair com o banco local via Docker Compose.

### Qualidade e deploy

Todo projeto com app sai com:

- `Dockerfile` por app, com build a partir da raiz do monorepo: Node com `pnpm deploy` (só dependências de produção), Next em modo `standalone`, Vite servido por nginx e FastAPI com uvicorn
- com Prisma, o container roda `prisma migrate deploy` antes de subir
- GitHub Actions (`.github/workflows/ci.yml`) com lint, testes, build e build das imagens
- ESLint (flat config na raiz, com `typescript-eslint` e regras de hooks do React no frontend) nos apps TypeScript; o FastAPI usa `ruff`

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
cd ~/projects   # o projeto é criado no diretório atual
create-stack
```

O CLI pergunta por:

- nome do projeto
- backend
- frontend
- autenticação (JWT próprio ou Firebase Auth)
- persistência inicial
- uso de Husky
- PostgreSQL local via Docker Compose (só quando a persistência é PostgreSQL)

O nome do projeto aceita letras minúsculas, números, `.`, `_` e `-`, porque vira nome de pasta, de pacote e de container.

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
- `POST /api/auth/register` (só com JWT próprio)
- `POST /api/auth/login` (só com JWT próprio)
- `GET /api/users/me`

## Fluxo após gerar um projeto

O CLI já roda `git init` e `pnpm install`, e gera `apps/backend/.env` com um `JWT_ACCESS_SECRET` aleatório (fora do git). Com Firebase, preencha `FIREBASE_PROJECT_ID` no backend e a config web do Firebase no frontend. O `.env.example` versionado não traz segredo nenhum. Os próximos passos também aparecem no terminal:

```bash
cd <nome-do-projeto>
```

### Infra local

Se o projeto foi gerado com PostgreSQL local:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### Backend Node

```bash
pnpm dev:backend
```

Se o projeto usar PostgreSQL, rode a migration antes:

```bash
pnpm --filter @apps/backend db:migrate
pnpm dev:backend
```

### Backend FastAPI (Python >= 3.12)

```bash
cd apps/backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
make test
make dev
```

Com PostgreSQL, as tabelas são criadas no startup. O README gerado explica como migrar para Alembic quando o schema evoluir.

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

Cada stack é validada pelo smoke test (ver abaixo).

Evoluções naturais que ainda fazem sentido:

- rodar o smoke test em CI
- Redis (saiu do scaffold até existir um uso real, como cache ou fila)
- mais testes gerados
- variantes assíncronas no FastAPI
- módulos mais ricos por contexto de domínio

## Desenvolvendo o CLI

Os templates ficam em strings dentro de `src/generators`, então o editor não checa o código gerado. Antes de publicar uma mudança, rode:

```bash
pnpm smoke
```

O smoke gera Nest, Express e FastAPI (com e sem PostgreSQL, com JWT e com Firebase), mais Next e Vite, num diretório temporário. Em cada um roda build, testes e lint, e builda a imagem de cada app, sobe o container e espera o health responder. Nos backends sem banco, sobe o servidor e testa a autenticação de verdade: `register → login → /users/me` no JWT, e um usuário criado no emulador do Firebase Auth chamando `/users/me` no Firebase.

As variantes com PostgreSQL sobem o banco pelo `docker-compose` gerado e rodam a migration antes do teste.

Requer `pnpm`, [`uv`](https://docs.astral.sh/uv/), Docker e `firebase-tools` com Java (para o emulador). Para rodar só alguns casos: `pnpm smoke nest-fb fastapi`.

## Stack do próprio CLI

- `TypeScript`
- `tsx`
- `@inquirer/prompts`
- `chalk`
- `ora`

## Licença

MIT
