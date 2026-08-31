# Contrato de WebSocket — Game Service

> **Status: proposta do frontend, aguardando alinhamento com o backend.**
> Este documento define o contrato de eventos WebSocket que o frontend
> (`frontend/src/services/socket.ts`, `frontend/src/hooks/useGameSocket.ts`)
> assume hoje. Se o backend (`services/games`) implementar algo diferente
> (nomes de evento, payloads, path de conexão), ajuste este arquivo e os
> tipos em `frontend/src/types/index.ts` de acordo — eles foram
> centralizados justamente para tornar essa mudança de um lugar só.

## Conexão

- Biblioteca: `socket.io` (cliente `socket.io-client`, servidor `@nestjs/websockets` com adapter `socket.io`).
- URL: via Kong, `http://localhost:8000`.
- Path: `/games/socket.io` (namespace default do socket.io, roteado pelo Kong através da rota `/games` já existente em `docker/kong/kong.yml`).
- Autenticação: handshake `auth: { token: <JWT do Keycloak> }`. O gateway deve validar o JWT na conexão (`handleConnection`) e desconectar clientes sem token válido.
- Não há eventos **client → server**. Apostar e sacar são sempre via REST (`POST /games/bet`, `POST /games/bet/cashout`); o WebSocket é usado exclusivamente para push de estado do servidor para os clientes.

## Eventos servidor → cliente

| Evento                    | Payload                                                                                   | Quando é emitido                                  |
| -------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `round:betting_open`       | `{ roundId: string, bettingEndsAt: string (ISO), serverSeedHash: string }`                 | Início da fase de apostas de uma nova rodada       |
| `round:started`            | `{ roundId: string, startedAt: string (ISO) }`                                             | Fim da fase de apostas, multiplicador começa a subir |
| `round:multiplier_tick`    | `{ roundId: string, multiplier: number, elapsedMs: number }`                               | A cada tick do multiplicador (sugestão: ~100ms)    |
| `round:crashed`            | `{ roundId: string, crashPoint: number, serverSeed: string, clientSeed: string, nonce: number }` | Rodada termina — inclui dados para verificação provably fair |
| `bet:placed`                | `{ roundId: string, betId: string, username: string, amountCents: number }`               | Um jogador aposta na rodada atual                  |
| `bet:cashed_out`            | `{ roundId: string, betId: string, username: string, multiplier: number, payoutCents: number }` | Um jogador saca durante a rodada                  |

Todos os valores monetários em **centavos inteiros** (nunca float).

## Consumo no frontend

- `frontend/src/services/socket.ts` — conexão socket.io autenticada.
- `frontend/src/hooks/useGameSocket.ts` — assina os eventos acima e atualiza `frontend/src/stores/gameStore.ts` (zustand).
- `frontend/src/hooks/useRounds.ts` (`useCurrentRound`) — snapshot REST inicial (`GET /games/rounds/current`) usado para hidratar a store antes do primeiro evento WS chegar (ver `gameStore.hydrateFromSnapshot`).

## Pontos a confirmar com o backend

1. O path `/games/socket.io` funciona atrás do Kong sem configuração adicional (upgrade de conexão HTTP)? Se não, pode ser necessário um plugin/rota dedicada no `kong.yml`.
2. Frequência do `round:multiplier_tick` — 100ms é só uma sugestão inicial.
3. Nome/namespace do socket.io caso o backend prefira um namespace dedicado (ex.: `/games`) em vez do path customizado.
