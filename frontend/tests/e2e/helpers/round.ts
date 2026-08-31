import { expect, type Page } from '@playwright/test'

/**
 * Rounds cycle continuously (BETTING_WINDOW_MS default 10s), so just
 * waiting for the bet button to be enabled can land right at the tail end
 * of the window — leaving no time to fill the input and click before it
 * closes. This waits for a window with enough time left to safely act.
 */
export async function waitForFreshBettingWindow(page: Page): Promise<void> {
  const betButton = page.getByRole('button', { name: /^apostar$/i })
  const countdown = page.getByTestId('betting-countdown')

  await expect(betButton).toBeEnabled({ timeout: 60_000 })

  await expect
    .poll(
      async () => {
        const text = await countdown.textContent().catch(() => null)
        return text ? Number.parseInt(text, 10) : 0
      },
      { timeout: 60_000, intervals: [250] },
    )
    .toBeGreaterThan(5)
}
