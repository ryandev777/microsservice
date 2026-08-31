/**
 * Money is always represented as integer cents on the wire and in state.
 * Never convert to a JS float for math — only for display formatting.
 */

const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function centsToDisplay(cents: number): string {
  return formatter.format(cents / 100)
}

export function reaisInputToCents(value: string): number | null {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim()
  if (normalized === '') return null

  const reais = Number(normalized)
  if (!Number.isFinite(reais)) return null

  return Math.round(reais * 100)
}

export const MIN_BET_CENTS = 100
export const MAX_BET_CENTS = 100_000

export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(2)}x`
}

export function potentialPayoutCents(betCents: number, multiplier: number): number {
  return Math.floor(betCents * multiplier)
}
