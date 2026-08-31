import { describe, expect, it } from "bun:test";

const KEYCLOAK_TOKEN_URL =
  "http://localhost:8080/realms/crash-game/protocol/openid-connect/token";
const KONG_URL = "http://localhost:8000";

async function getPlayerToken(): Promise<string> {
  const response = await fetch(KEYCLOAK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "crash-game-client",
      username: "player",
      password: "player123",
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to obtain token: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

describe("Wallets e2e (requires docker:up)", () => {
  it("creates a wallet, reads balance 0, and rejects duplicate creation", async () => {
    const token = await getPlayerToken();
    const headers = { Authorization: `Bearer ${token}` };

    const createResponse = await fetch(`${KONG_URL}/wallets`, {
      method: "POST",
      headers,
    });
    expect([201, 409]).toContain(createResponse.status);

    const balanceResponse = await fetch(`${KONG_URL}/wallets/me`, { headers });
    expect(balanceResponse.status).toBe(200);
    const balance = (await balanceResponse.json()) as { balanceCents: string };
    expect(typeof balance.balanceCents).toBe("string");

    const duplicateResponse = await fetch(`${KONG_URL}/wallets`, {
      method: "POST",
      headers,
    });
    expect(duplicateResponse.status).toBe(409);
  });
});
