import type { Page } from '@playwright/test'

const TEST_USERNAME = process.env.E2E_PLAYER_USERNAME ?? 'player'
const TEST_PASSWORD = process.env.E2E_PLAYER_PASSWORD ?? 'player123'

/** Logs in as the seeded Keycloak test player (see docker/keycloak/realm-export.json) and waits for the app to land on the game page. */
export async function loginAsPlayer(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByRole('button', { name: /entrar com keycloak/i }).click()

  await page.waitForURL(/\/realms\/.+\/protocol\/openid-connect\/auth/)
  // Keycloak's default theme (keycloak.v2) doesn't associate the "Password"
  // <label> with its <input> in a way getByLabel resolves reliably, so this
  // targets the actual field ids the theme renders.
  await page.locator('#username').fill(TEST_USERNAME)
  await page.locator('#password').fill(TEST_PASSWORD)
  await page.locator('#kc-login').click()

  await page.waitForURL('/')
}
