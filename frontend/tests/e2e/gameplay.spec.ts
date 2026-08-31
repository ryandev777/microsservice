import { expect, test } from '@playwright/test'
import { loginAsPlayer } from './helpers/auth'
import { isBackendUp } from './helpers/backend'
import { waitForFreshBettingWindow } from './helpers/round'

test.describe('gameplay (requires `bun run docker:up`)', () => {
  // The round loop is a single shared scheduler, not per-test state — every
  // worker watches the same live round. Serial execution avoids three
  // browsers burning parallel time waiting on the exact same round. The
  // extended timeout covers both login and the round-timing waits inside
  // each test — test.setTimeout() inside a test body doesn't retroactively
  // cover its own beforeEach, so it has to be set here instead.
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async () => {
    if (!(await isBackendUp())) {
      test.skip(true, 'Keycloak/Kong/games/wallets are not reachable — run `bun run docker:up` first')
    }
  })

  test.beforeEach(async ({ page }) => {
    await loginAsPlayer(page)
  })

  test('shows the player balance and username after login', async ({ page }) => {
    await expect(page.getByText('Jogador')).toBeVisible()
    await expect(page.getByText('Saldo')).toBeVisible()
    // The seeded test player's wallet starts funded (INITIAL_WALLET_BALANCE_CENTS).
    await expect(page.getByText(/R\$\s*[1-9]/)).toBeVisible({ timeout: 15_000 })
  })

  test('placing a bet during the betting phase enables it and disables re-betting', async ({ page }) => {
    const betInput = page.getByLabel(/valor da aposta/i)
    const betButton = page.getByRole('button', { name: /^apostar$/i })

    await waitForFreshBettingWindow(page)

    await betInput.fill('10,00')
    await betButton.click()

    await expect(page.getByText('Apostando...')).toHaveCount(0, { timeout: 5000 })
    await expect(betInput).toBeDisabled()
  })

  test('cash out becomes available once the round is running with a pending bet', async ({ page }) => {
    const betInput = page.getByLabel(/valor da aposta/i)
    const betButton = page.getByRole('button', { name: /^apostar$/i })
    const cashoutButton = page.getByRole('button', { name: /cash out/i })

    // The crash point is unbounded on both ends: most rounds resolve within
    // a couple of seconds (multiplier growth is exponential — 1.06 per
    // 100ms tick by default), so a low crash point can close the RUNNING
    // window before we get to act; a rare high one can also make a single
    // wait-for-betting-window take a while. This is best-effort against a
    // live, non-deterministic scheduler — the "seed determinística para
    // testes E2E" bonus in the README exists for exactly this reason, and
    // would let this test act on a scripted crash point instead.
    let cashedOut = false
    for (let attempt = 0; attempt < 10 && !cashedOut; attempt++) {
      await waitForFreshBettingWindow(page)
      await betInput.fill('10,00')
      await betButton.click()

      try {
        await expect(cashoutButton).toBeEnabled({ timeout: 6000 })
        await expect(cashoutButton).toHaveText(/cash out \(R\$/i)
        await cashoutButton.click()
        await expect(page.getByText(/cash out em \d+\.\d{2}x/i)).toBeVisible({ timeout: 5000 })
        cashedOut = true
      } catch {
        // Round crashed before cash out could fire — loop back for a fresh window.
      }
    }

    expect(cashedOut).toBe(true)
  })
})
