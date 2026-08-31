# Crash Game — Frontend

SPA em React que implementa a UI do Crash Game descrita no README raiz do repositório.

## Stack

- **Vite + React + TypeScript** (strict mode)
- **Tailwind CSS v4** (config via `@theme` em `src/index.css`, sem `tailwind.config.js`) + componentes no estilo shadcn/ui escritos à mão em `src/components/ui/`
- **TanStack Query** para estado de servidor (wallet, rounds, bets)
- **Zustand** (`src/stores/gameStore.ts`) para o estado ao vivo do jogo, alimentado pelos eventos de WebSocket
- **react-oidc-context** + **oidc-client-ts** para login OIDC (Authorization Code + PKCE) contra o Keycloak
- **socket.io-client** para os eventos em tempo real do Game Service
- **Vitest** + **React Testing Library** para testes

## Setup

```bash
cd frontend
bun install
cp .env.example .env   # ajuste as URLs se necessário
bun run dev             # http://localhost:5173
```

Outros comandos:

```bash
bun run build   # typecheck (tsc -b) + build de produção
bun run test    # roda a suíte de testes (vitest)
bun run lint    # oxlint
```

## Variáveis de ambiente

| Variável                    | Descrição                                              | Default                |
| ---------------------------- | -------------------------------------------------------- | ----------------------- |
| `VITE_API_BASE_URL`          | Base REST, via Kong                                       | `http://localhost:8000` |
| `VITE_WS_URL`                | Base do WebSocket, via Kong                                | `http://localhost:8000` |
| `VITE_KEYCLOAK_URL`          | URL do Keycloak                                            | `http://localhost:8080` |
| `VITE_KEYCLOAK_REALM`        | Realm                                                      | `crash-game`             |
| `VITE_KEYCLOAK_CLIENT_ID`    | Client público (PKCE)                                      | `crash-game-client`      |

## Decisões de arquitetura

- **Dinheiro em centavos inteiros** em toda a aplicação (`src/lib/money.ts`): a API é assumida como retornando `amountCents`/`balanceCents` como inteiros; a conversão para exibição (formatação BRL) acontece só na borda de apresentação, nunca em cálculos.
- **Estado de jogo em tempo real vive no zustand** (`gameStore`), atualizado exclusivamente pelos eventos de WebSocket (`useGameSocket`). O snapshot REST (`GET /games/rounds/current`) é usado apenas para hidratar o estado inicial antes do primeiro evento chegar — depois disso o WebSocket é a fonte de verdade.
- **Estado de servidor (wallet, histórico, apostas do jogador) vive no TanStack Query** — cache, invalidação após apostar/sacar, retry.
- **Contrato de WebSocket** ainda não estava definido pelo backend no momento em que este frontend foi construído (desenvolvimento em paralelo). O contrato assumido está documentado em [`../docs/websocket-contract.md`](../docs/websocket-contract.md) e centralizado em `src/types/index.ts` — qualquer ajuste no payload real do backend deve mudar apenas esses dois lugares.
- **shadcn/ui sem CLI**: o `bunx shadcn init` não completou de forma confiável neste monorepo (Bun workspaces), então os componentes base (`button`, `input`, `card`, `skeleton`) foram escritos manualmente seguindo o mesmo padrão (Radix + `class-variance-authority` + `cn`), preservando a possibilidade de usar `bunx shadcn add <component>` para novos componentes no futuro.
- **Auth via `react-oidc-context`** em vez de `keycloak-js`: mantém a troca por Auth0/Okta (permitida pelo desafio) restrita a `src/services/auth.ts`, sem acoplar o resto da app a APIs específicas do Keycloak.

## Estrutura

```
src/
  components/   # CrashChart, BettingControls, RoundBetsList, RoundHistory, PlayerInfo, ProtectedRoute, ui/
  hooks/        # useGameSocket, useApiAuthSync, useWalletMe, useCurrentRound, usePlaceBet, useCashout...
  pages/        # LoginPage, CallbackPage, GamePage
  services/     # api.ts (REST), socket.ts (WS), auth.ts (config OIDC)
  stores/       # gameStore.ts (zustand)
  lib/          # money.ts, utils.ts
  types/        # tipos de domínio + payloads de WebSocket
```

## Estado atual / próximos passos

Este frontend foi construído contra o contrato de API assumido (ver `docs/websocket-contract.md` e o `README.md` raiz) enquanto o backend era desenvolvido em paralelo em outra sessão. Sem o backend no ar, a tela do jogo mostra estados de loading/erro de forma graciosa. Antes de considerar o fluxo completo, validar manualmente com `bun run docker:up`:

- Login end-to-end contra o Keycloak real
- `GET /games/rounds/current` e os eventos de WebSocket batendo com os payloads assumidos
- Fluxo completo: apostar → multiplicador sobe → cash out / crash → saldo atualizado
