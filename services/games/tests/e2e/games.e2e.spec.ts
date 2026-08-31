import { describe, expect, it } from "bun:test";
import { io, type Socket } from "socket.io-client";

const KEYCLOAK_TOKEN_URL = "http://localhost:8080/realms/crash-game/protocol/openid-connect/token";
const KONG_URL = "http://localhost:8000";
const GAMES_WS_URL = "http://localhost:4001/games";

async function getPlayerToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: "crash-game-client",
    username: "player",
    password: "player123",
  });
  const res = await fetch(KEYCLOAK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Failed to get token: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

function waitForEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 20_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function ensureWallet(token: string): Promise<void> {
  await fetch(`${KONG_URL}/wallets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * These tests require the full stack to be up (`bun run docker:up`), with
 * the Keycloak `player`/`player123` test user pre-seeded with enough
 * balance (via the wallet endpoint) and RABBITMQ/Games/Wallets healthy.
 * They are intentionally not run as part of `bun test tests/unit`.
 */
describe("Games e2e", () => {
  it("happy path: bet -> confirmed -> cashout -> credited", async () => {
    const token = await getPlayerToken();
    await ensureWallet(token);

    const socket = io(GAMES_WS_URL, { auth: { token }, transports: ["websocket"] });
    await new Promise<void>((resolve) => socket.on("connect", () => resolve()));

    await waitForEvent(socket, "round:betting_open");

    const betRes = await fetch(`${KONG_URL}/games/bet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: 100 }),
    });
    expect(betRes.status).toBe(201);

    await waitForEvent(socket, "bet:confirmed");
    await waitForEvent(socket, "round:started");

    const cashoutRes = await fetch(`${KONG_URL}/games/bet/cashout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(cashoutRes.status).toBe(201);

    await waitForEvent(socket, "bet:cashed_out");

    const walletRes = await fetch(`${KONG_URL}/wallets/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const wallet = (await walletRes.json()) as { balanceCents: string };
    expect(Number(wallet.balanceCents)).toBeGreaterThan(0);

    socket.close();
  }, 30_000);

  it("crash without cashout results in a LOST bet", async () => {
    const token = await getPlayerToken();
    const socket = io(GAMES_WS_URL, { auth: { token }, transports: ["websocket"] });
    await new Promise<void>((resolve) => socket.on("connect", () => resolve()));

    await waitForEvent(socket, "round:betting_open");
    await fetch(`${KONG_URL}/games/bet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: 100 }),
    });
    await waitForEvent(socket, "bet:confirmed");
    await waitForEvent(socket, "round:crashed", 30_000);

    const myBetsRes = await fetch(`${KONG_URL}/games/bets/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const myBets = (await myBetsRes.json()) as { items: Array<{ status: string }> };
    expect(myBets.items.some((b) => b.status === "LOST" || b.status === "WON")).toBe(true);

    socket.close();
  }, 40_000);

  it("rejects a second bet in the same round with 409", async () => {
    const token = await getPlayerToken();
    const socket = io(GAMES_WS_URL, { auth: { token }, transports: ["websocket"] });
    await new Promise<void>((resolve) => socket.on("connect", () => resolve()));
    await waitForEvent(socket, "round:betting_open");

    await fetch(`${KONG_URL}/games/bet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: 100 }),
    });
    const second = await fetch(`${KONG_URL}/games/bet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: 100 }),
    });
    expect(second.status).toBe(409);

    socket.close();
  }, 20_000);

  it("rejects betting outside the betting phase with 409", async () => {
    const token = await getPlayerToken();
    const socket = io(GAMES_WS_URL, { auth: { token }, transports: ["websocket"] });
    await new Promise<void>((resolve) => socket.on("connect", () => resolve()));
    await waitForEvent(socket, "round:started", 15_000);

    const res = await fetch(`${KONG_URL}/games/bet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: 100 }),
    });
    expect(res.status).toBe(409);

    socket.close();
  }, 20_000);
});
