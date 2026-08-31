# Contrato de WebSocket — Game Service

> **Status: confirmado contra a implementação real do backend**
> (`services/games/src/infrastructure/websocket/game.gateway.ts`,
> `.../scheduler/round-lifecycle.scheduler.ts` e os use cases
> `confirm-bet`/`confirm-cashout`/`reject-bet`). Espelhado em
> `frontend/src/types/index.ts` — qualquer mudança futura no backend deve
> atualizar os dois lugares juntos.

## Conexão

- Biblioteca: `socket.io` (cliente `socket.io-client`, servidor `@nestjs/websockets` com adapter `socket.io`).
- URL: via Kong, `http://localhost:8000`.
- Path: `/games/socket.io` (namespace default do socket.io; Kong encaminha o prefixo `/games` sem remover — `strip_path: false`).
- Autenticação: handshake `auth: { token: <JWT do Keycloak> }`. O gateway decodifica e valida o token (JWKS) em `handleConnection` para descobrir o `playerId` e colocar o socket na room `player:<playerId>` — a conexão **não** é recusada se o token faltar/for inválido, ela só não entra na room privada do jogador (logo eventos `bet:rejected` não chegam a esse socket) e não conta como "online" (ver `players:online` abaixo).
- Ao conectar, o socket recebe um `players:online` (snapshot) e um `round:snapshot` com o estado completo da rodada atual — não é necessário fazer `GET /games/rounds/current` antes de conectar, mas o frontend ainda faz essa chamada REST para pintar a tela mais rápido, antes do socket conectar.
- Todos os eventos de rodada/aposta (exceto `bet:rejected`, privado) são transmitidos **globalmente** (`server.emit`), não por room de rodada — só existe uma rodada ativa por vez no serviço inteiro, então não há isolamento a fazer. Uma primeira versão usava uma room `round:<roundId>`, mas sockets só entravam nela na conexão e nunca migravam para a rodada seguinte, então todo cliente parava de receber eventos assim que a rodada em que conectou terminava (ver commit `fix(games): broadcast round/bet events to every client, not a stale room`).
- Não há eventos **client → server**. Apostar e sacar são sempre via REST (`POST /games/bet`, `POST /games/bet/cashout`); o WebSocket é usado exclusivamente para push de estado do servidor para os clientes.

## Eventos servidor → cliente

| Evento                 | Emitido para                      | Payload                                                                              |
| ----------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `round:snapshot`        | socket individual (connect)        | `{ round: CurrentRoundView }` — mesmo shape do `GET /games/rounds/current`            |
| `players:online`        | socket individual (connect) + broadcast a cada entrada/saída | `{ count: number, players: Array<{ playerId, username }> }` — só conta sockets autenticados; multi-aba do mesmo jogador conta uma vez |
| `round:betting_open`    | todos                               | `{ roundId, serverSeedHash, bettingEndsAt }`                                          |
| `round:started`         | todos                               | `{ roundId, startedAt }`                                                                |
| `round:multiplier_tick` | todos                               | `{ roundId, multiplier, elapsedMs }` (a cada `TICK_INTERVAL_MS`, default 100ms)        |
| `round:crashed`         | todos                               | `{ roundId, crashPoint, crashedAt, serverSeed, serverSeedHash, clientSeed, nonce }`    |
| `round:settled`         | todos                               | `{ roundId, lostBetsCount }` — emitido depois que as apostas perdedoras são liquidadas |
| `bet:confirmed`         | todos                               | `{ betId, playerId, username, amountCents }` — só depois que o Wallet confirma o débito |
| `bet:cashed_out`        | todos                               | `{ betId, playerId, username, multiplier, payoutAmountCents }`                         |
| `bet:rejected`          | apenas o jogador (`player:<id>`)   | `{ betId, reason }` — débito no Wallet falhou (ex.: saldo insuficiente)                |

`CurrentRoundView` (usado tanto em `round:snapshot` quanto em `GET /games/rounds/current`):

```ts
{
  roundId: string
  status: 'BETTING' | 'RUNNING' | 'CRASHED' | 'SETTLED'
  serverSeedHash: string
  bettingEndsAt: string          // ISO
  startedAt: string | null       // ISO
  currentMultiplier: number | null
  activeBets: Array<{ betId, playerId, username, amountCents: string, status }>
}
```

**Dinheiro sempre como string na borda**: `amountCents`/`payoutAmountCents` são um `BigInt` internamente
(`services/games/src/domain/shared/money.vo.ts` e o equivalente em `wallets`) serializado como string em todo
JSON de resposta e evento — `JSON.stringify` não representa `BigInt` nativamente. `frontend/src/lib/money.ts`
(`centsToNumber`/`centsToDisplay`) é o único lugar que faz essa conversão para exibição.

## Consumo no frontend

- `frontend/src/services/socket.ts` — conexão socket.io autenticada.
- `frontend/src/hooks/useGameSocket.ts` — assina todos os eventos acima e atualiza `frontend/src/stores/gameStore.ts` (zustand); `bet:rejected` não altera estado, só dispara um toast de erro para o próprio jogador. `players:online` alimenta `frontend/src/components/OnlinePlayers.tsx` e o contador no header do `GamePage`.
- `frontend/src/hooks/useRounds.ts` (`useCurrentRound`) — snapshot REST inicial, usado só para a primeira pintura da tela antes do socket conectar (`GamePage` chama `gameStore.onSnapshot` com o resultado); o `round:snapshot` do WebSocket, que chega logo em seguida, é quem manda de fato dali pra frente.
