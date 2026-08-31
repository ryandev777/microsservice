const KEYCLOAK_URL = process.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080'
const KEYCLOAK_REALM = process.env.VITE_KEYCLOAK_REALM ?? 'crash-game'

/**
 * The full stack (Keycloak + Kong + games + wallets) is only up when the
 * candidate runs `bun run docker:up`. Specs that need a real login/gameplay
 * flow should skip themselves rather than fail when it's not running.
 */
export async function isBackendUp(): Promise<boolean> {
  try {
    const response = await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}
