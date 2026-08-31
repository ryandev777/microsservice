import { expect, test } from '@playwright/test'

test.describe('authentication', () => {
  test('redirects an unauthenticated visitor to /login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('/login')
    await expect(page.getByRole('heading', { name: 'Crash Game' })).toBeVisible()
  })

  test('login page shows the Keycloak entry point', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'Crash Game' })).toBeVisible()
    await expect(page.getByText('Entre com sua conta para jogar.')).toBeVisible()
    await expect(page.getByRole('button', { name: /entrar com keycloak/i })).toBeEnabled()
  })

  test('clicking "Entrar com Keycloak" starts the OIDC authorization code redirect', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /entrar com keycloak/i }).click()

    // Whether or not Keycloak itself is reachable, the SPA must attempt the
    // PKCE authorization-code redirect to the realm's /auth endpoint.
    await page.waitForURL(/\/realms\/.+\/protocol\/openid-connect\/auth\?/, { timeout: 5000 })
    const url = new URL(page.url())
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  test('an unauthenticated visitor cannot reach protected REST-backed content', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('/login')
    // No token was ever issued, so nothing under the protected route rendered.
    await expect(page.getByText('Saldo')).toHaveCount(0)
  })
})
