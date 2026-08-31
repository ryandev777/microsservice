# Crash Game — Documentação Técnica de Entrega

> Documento técnico de entrega conforme solicitado no `README.md` raiz (seção "Entrega"): instruções de setup, decisões de arquitetura e trade-offs. Este documento descreve a implementação **real**, verificada diretamente no código-fonte — não o enunciado do desafio.

---

## 1. Setup

### Pré-requisitos

- Bun >= 1.x
- Docker & Docker Compose

### Subir o ambiente completo

```bash
bun install
bun run docker:up      # infra + serviços + frontend, sem passos manuais
```

Isso sobe, na ordem correta (via `depends_on` + healthchecks):

| Serviço        | Imagem/Build                       | Porta local              |
| -------------- | ----------------------------------- | ------------------------- |
| PostgreSQL 18  | `postgres:18.3-alpine`              | `5432` (bancos `games`, `wallets`) |
| RabbitMQ       | `rabbitmq:4.2.4-management-alpine`  | `5672` (AMQP), `15672` (UI) |
| Keycloak       | `quay.io/keycloak/keycloak:26.5.5`  | `8080` (realm `crash-game` importado automaticamente) |
| Kong           | `kong:3.9.1` (DB-less/declarativo)  | `8000` (proxy), `8001` (admin) |
| Game Service   | build local (NestJS)                | `4001` direto / `http://localhost:8000/games/*` via Kong |
| Wallet Service | build local (NestJS)                | `4002` direto / `http://localhost:8000/wallets/*` via Kong |
| Frontend       | build local (Vite + React)          | `3000`                    |

Migrations do Prisma e `prisma generate` rodam automaticamente no boot do container de cada serviço (ver commits `700d47a`, `23928ce`).

Usuário de teste pré-configurado no Keycloak: `player` / `player123`. A carteira do jogador é criada e financiada automaticamente no primeiro `POST /wallets` — não existe endpoint de depósito manual; ver seção 4.

### Rodar testes

```bash
cd services/games && bun test tests/unit
cd services/wallets && bun test tests/unit
cd services/games && bun test tests/e2e     # requer docker:up
cd frontend && bun test                     # Vitest, unitário/componentes
cd frontend && bun run test:e2e             # Playwright, requer docker:up
```

---

## 2. Arquitetura

```
Frontend (Vite + React 19)
   │ REST (axios)         │ WebSocket (socket.io-client)
   ▼                       ▼
Kong (declarativo, CORS habilitado para :3000/:5173)
   │ /games/*                          │ /wallets/*
   ▼                                   ▼
Game Service (NestJS, DDD)      Wallet Service (NestJS, DDD)
   │  Postgres "games"                 │  Postgres "wallets"
   │  RabbitMQ: games.events (pub) ────┼──▶ wallets.bet-processing
   │                                   │    wallets.cashout-processing
   │  games.wallet-results (consome) ◀─┼──  RabbitMQ: wallets.events (pub)
   ▼
Keycloak (OIDC, realm crash-game) — valida JWT via JWKS em ambos os serviços
```

Dois bounded contexts isolados, cada um com seu próprio banco Postgres, comunicando-se **exclusivamente por eventos assíncronos via RabbitMQ** — nunca por chamada HTTP direta entre si. Nenhum dos dois expõe crédito/débito de saldo via REST (conforme exigido no enunciado); essas operações só acontecem como reação a eventos do outro serviço.

### 2.1 Game Service — domínio

- **`Round`** (`services/games/src/domain/round/round.aggregate.ts`) — máquina de estados `BETTING → RUNNING → CRASHED → SETTLED`. O `crashPoint` é calculado **no momento da criação da rodada** (determinístico a partir do seed pair), mas fica oculto: `revealSeed()` só retorna o `serverSeed` quando o status já é `CRASHED`/`SETTLED`, garantindo que nenhum client possa antecipar o resultado.
- **`Bet`** — uma aposta por rodada por jogador, garantido por constraint única `(roundId, playerId)` na tabela (não em memória).
- **Provably fair** (`domain/provably-fair/provably-fair.service.ts`) — algoritmo `HMAC_SHA256_V1`, ver seção 3.
- **`RoundLifecycleScheduler`** (`infrastructure/scheduler/round-lifecycle.scheduler.ts`) — único ponto que dirige o loop de rodadas; todo client vê exatamente a mesma sequência de eventos porque ela nasce ali. Timers configuráveis via env: `BETTING_WINDOW_MS` (10s), `TICK_INTERVAL_MS` (100ms), `HOUSE_EDGE` (0.01), `MULTIPLIER_GROWTH_RATE` (1.06), `ROUND_COOLDOWN_MS` (3s).
- **`MultiplierClockService`** — `multiplier = growthRate ^ (elapsedMs / 1000)`, fonte única de verdade reutilizada pelo tick do WebSocket, pelo snapshot de reconexão e pelo `RequestCashoutUseCase` — o multiplicador enviado pelo client **nunca** é confiado; o cashout usa o valor recalculado no servidor no instante em que a requisição chega.

### 2.2 Wallet Service — domínio

- **`Wallet`** (`services/wallets/src/domain/wallet/wallet.aggregate.ts`) — uma por jogador, saldo em **centavos inteiros** (`BigInt` em domínio, `BIGINT` no Postgres, nunca `float`). `debit()` lança `InsufficientFundsError` sem mutar estado se `!balance.canSubtract(amount)`; saldo nunca fica negativo.
- Toda operação de crédito/débito gera um `WalletTransaction` (ledger de auditoria), referenciado por `referenceId` (o `betId`).

### 2.3 Comunicação assíncrona e saga de consistência

RabbitMQ com dois **topic exchanges** duráveis (`games.events`, `wallets.events`) mais um **outbox transacional em cada serviço** — não pub/sub direto do handler HTTP.

**Padrão Outbox → Relay → Inbox** (idêntico nos dois serviços):

1. O use case grava a mudança de domínio e a linha `OutboxMessage` **na mesma transação** de banco.
2. Um worker (`GamesOutboxRelayWorker` / `WalletOutboxRelayWorker`) faz polling a cada 200ms, publica lotes de até 50 mensagens no exchange com `routingKey = eventType`, e só marca `publishedAt` depois da confirmação do broker (`ConfirmChannel`). Se o broker cair, a linha permanece não publicada e é reentregue no próximo tick — **at-least-once**.
3. O consumidor lê o `eventType` do **routing key do envelope AMQP**, não do corpo JSON — assim reenvios nunca mudam o payload, o que simplifica deduplicação. A tabela `InboxMessage` (chave primária = `messageId`) garante processamento **exactly-once** do lado do consumidor.

**Fluxo de aposta (happy path):**

```
POST /games/bet
  → PlaceBetUseCase grava Bet(PLACED_PENDING) + Outbox("bet.placed")
  → games outbox relay publica em games.events (routing key "bet.placed")
  → wallets consome via fila "wallets.bet-processing"
  → HandleBetPlacedUseCase debita a Wallet, grava Outbox("wallet.debit.succeeded")
  → wallets outbox relay publica em wallets.events
  → games consome via fila "games.wallet-results" (bindings: wallet.debit.succeeded/failed,
     wallet.credit.succeeded/failed)
  → ConfirmBetUseCase marca Bet como CONFIRMED
  → WebSocket: bet:confirmed para a room da rodada
```

**Compensação (saldo insuficiente):** `wallets` publica `wallet.debit.failed` → `RejectBetUseCase` no games marca a `Bet` como rejeitada → evento **privado** `bet:rejected` só para a room `player:<id>` do apostador (nenhum outro jogador vê a tentativa falha).

**Cashout** segue o mesmo padrão: `POST /games/bet/cashout` → `bet.cashout.requested` → `wallets` credita → `wallet.credit.succeeded` → `ConfirmCashoutUseCase` → `bet:cashed_out` no WebSocket.

**Dead-lettering:** o games declara `games.events.dlx` (exchange) + `games.dlq` (fila, bind `#`); o consumidor de `games.wallet-results` faz `nack(msg, false, false)` em caso de erro de processamento, roteando direto para a DLQ. Não há retry incremental com backoff — decisão explícita de escopo (comentário em `wallet-events.consumer.ts`), fora do requisito do desafio.

### 2.4 WebSocket



- Servidor → cliente apenas (apostar/sacar são sempre REST).
- Handshake autenticado via JWT (`auth: { token }`); conexão sem token válido ainda é aceita, só não entra na room privada `player:<id>` (logo não recebe `bet:rejected`).
- Eventos: `round:snapshot`, `round:betting_open`, `round:started`, `round:multiplier_tick`, `round:crashed`, `round:settled`, `bet:confirmed`, `bet:cashed_out`, `bet:rejected`.
- Dinheiro sempre serializado como **string** em qualquer payload JSON (REST ou WS) — `BigInt` não é serializável nativamente.

### 2.5 API Gateway (Kong)

Config declarativa (`docker/kong/kong.yml`), duas rotas `strip_path: false` (os serviços já expõem `/games/*` e `/wallets/*`), plugin CORS global liberando `localhost:3000`/`:5173` com métodos `GET/POST/OPTIONS` e header `Authorization` — sem isso, todo GET simples falha silenciosamente por falta de `Access-Control-Allow-Origin` e todo request com `Authorization` falha o preflight `OPTIONS` (nenhum dos dois serviços trata `OPTIONS`).

### 2.6 Autenticação

Keycloak (realm `crash-game`, client público `crash-game-client`, PKCE S256). Ambos os serviços validam o JWT via JWKS (`jwks-rsa` + `passport-jwt`/`AuthGuard('jwt')`) — nunca confiam em claims não assinadas. `KEYCLOAK_ISSUER` usa `localhost:8080` (precisa bater com o claim `iss` do token, que reflete o host usado pelo browser) enquanto `KEYCLOAK_JWKS_URI` usa o nome do serviço na rede Docker (`keycloak:8080`) — são propósitos diferentes: um é comparação de claim, o outro é chamada de rede.

---

## 3. Algoritmo Provably Fair — `HMAC_SHA256_V1`

Implementado em `services/games/src/domain/provably-fair/provably-fair.service.ts`, inspirado no modelo clássico de crash games (Bustabit-style):

1. Servidor gera `serverSeed` (32 bytes aleatórios) e publica **apenas** `serverSeedHash = SHA256(serverSeed)` no início da fase de apostas (evento `round:betting_open`) — o jogador vê o compromisso antes de apostar, mas não consegue derivar o resultado.
2. `hmac = HMAC_SHA256(key = serverSeed, message = "${clientSeed}:${nonce}")`.
3. Os primeiros 13 hex chars (52 bits) do HMAC viram um inteiro `intValue`.
4. Instant-crash (1.00x): se `intValue % round(1/houseEdge) === 0` (com `houseEdge = 0.01`, ocorre em ~1% das rodadas).
5. Caso contrário: `crashPoint = floor((100 - houseEdge×100) × 2^52 / (2^52 - intValue)) / 100`.

Resultado determinístico e simétrico: qualquer pessoa com `serverSeed`, `clientSeed`, `nonce` e `houseEdge` recalcula exatamente o mesmo crash point, e pode conferir `SHA256(serverSeed) === serverSeedHash` publicado antes da rodada. Exposto ao jogador via `GET /games/rounds/:roundId/verify` e no payload do evento `round:crashed` (`serverSeed`, `serverSeedHash`, `clientSeed`, `nonce`).

---

## 4. Referência de API (via Kong, `http://localhost:8000`)

| Método | Endpoint | Auth | Descrição |
| --- | --- | --- | --- |
| `GET` | `/games/health` | Não | Healthcheck |
| `GET` | `/games/rounds/current` | Não | Estado da rodada atual (mesmo shape do `round:snapshot`) |
| `GET` | `/games/rounds/history` | Não | Histórico paginado (`limit`, `cursor`) |
| `GET` | `/games/rounds/:roundId/verify` | Não | Dados de verificação provably fair (404 se não existe, 409 se ainda não crashou) |
| `GET` | `/games/bets/me` | Sim | Histórico de apostas do jogador (paginado) |
| `POST` | `/games/bet` | Sim | Aposta na rodada atual (409 se rodada não está em BETTING, ou aposta duplicada; 503 se não há rodada corrente) |
| `POST` | `/games/bet/cashout` | Sim | Cashout no multiplicador atual (409 se sem aposta pendente ou rodada não RUNNING) |
| `GET` | `/wallets/health` | Não | Healthcheck |
| `POST` | `/wallets` | Sim | Cria carteira do jogador autenticado (financiada com `INITIAL_WALLET_BALANCE_CENTS`, hoje 100000 = R$1000,00) |
| `GET` | `/wallets/me` | Sim | Saldo do jogador |

---

## 5. Frontend

Stack real (não a sugerida no enunciado, mas dentro das opções aceitas): **Vite + React 19 + TypeScript**, Tailwind CSS v4 + componentes estilo shadcn/ui, TanStack Query (server state) + Zustand (`gameStore`, estado em tempo real vindo do socket), `react-oidc-context`/`oidc-client-ts` para o fluxo OIDC com Keycloak, `socket.io-client`, `axios`, `motion` para animação do gráfico, `sonner` para toasts.

- `frontend/src/services/socket.ts` — conexão autenticada.
- `frontend/src/hooks/useGameSocket.ts` — assina os eventos do gateway e atualiza `gameStore`.
- `frontend/src/hooks/useRounds.ts` — snapshot REST inicial só para pintar a tela antes do socket conectar; o `round:snapshot` do WebSocket assume o estado a partir daí.
- `frontend/src/lib/money.ts` — único ponto que converte os centavos (string) vindos da API para exibição.

### Testes

- **Vitest** (`frontend/src/tests`) — unitário/componentes.
- **Playwright** (`frontend/tests/e2e`) — `auth.spec.ts` (fluxo de login OIDC) e `gameplay.spec.ts` (fluxo real de jogo rodando contra `docker:up`), com helpers de login/backend em `tests/e2e/helpers`.

---

## 6. Testes automatizados (backend)

Unitários (camada de domínio/aplicação):

- `round.aggregate.spec.ts`, `bet.entity.spec.ts`, `provably-fair.service.spec.ts`, `multiplier-clock.service.spec.ts` (games)
- `wallet.aggregate.spec.ts`, `money.vo.spec.ts` (wallets)
- Use cases: `place-bet`, `request-cashout`, `settle-round` (games); `handle-bet-placed`, `handle-cashout-requested` (wallets)

E2E (camada de API, requer `docker:up`): `services/games/tests/e2e/games.e2e.spec.ts`, `services/wallets/tests/e2e/wallets.e2e.spec.ts`.

---

## 7. Decisões de arquitetura e trade-offs

| Decisão | Por quê | Trade-off aceito |
| --- | --- | --- |
| Outbox+Inbox transacional em ambos os serviços, em vez de publish direto no handler | Garante que o evento só existe se a transação de domínio commitou, e que o consumidor nunca processa a mesma mensagem duas vezes | Latência extra de até `POLL_INTERVAL_MS` (200ms) entre a mudança de domínio e a publicação; mais uma tabela e um worker por serviço |
| Crash point calculado e persistido no início da rodada, revelado só depois do crash | Prova de que o resultado não foi manipulado após ver as apostas — requisito central do provably fair | O valor "correto" já existe em banco durante toda a fase de apostas/rodada; a segurança depende inteiramente de nunca vazá-lo pela camada de apresentação antes da hora (mitigado por getter dedicado `revealSeed()` com guarda de status) |
| Multiplicador recalculado no servidor a cada cashout, nunca aceito do client | Um client comprometido/adiantado no relógio não pode sacar com um multiplicador maior do que o real | Nenhum — é puramente defensivo, sem custo de UX perceptível |
| DLQ sem retry incremental com backoff | Fora do escopo de tempo do desafio; erro de processamento vai direto para a fila morta | Falhas transitórias (ex.: erro de deploy) exigem replay manual da DLQ em vez de recuperação automática |
| Kong declarativo (DB-less) em vez de Kong com banco próprio | Menos um serviço com estado para orquestrar no `docker:up`; toda a config vive em um arquivo versionado | Mudanças de rota exigem reload do container em vez de chamada à Admin API |
| `strip_path: false` no Kong | Os serviços já assumem os prefixos `/games` e `/wallets` nas suas próprias rotas, batendo com a referência de API do README | Rotas internas dos serviços ficam acopladas ao prefixo esperado pelo gateway |
| `packages/` do monorepo ainda vazio | Nenhuma duplicação de código entre os dois serviços cresceu o suficiente para justificar extrair um pacote compartilhado (ex.: `Money`, `PlayerId` existem duplicados em cada serviço) | Qualquer mudança de regra em `Money`/`PlayerId` precisa ser replicada manualmente nos dois serviços |
