/**
 * Money is always integer cents on the wire — as a JSON string, since the
 * backend serializes a BigInt (see the games/wallets domain Money value
 * object). This module is the only place allowed to convert to/from that
 * representation; every other value in the app stays either a wire string
 * or a display string, never a float.
 */

const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Parses a wire cents string (or a plain number already in cents) into a display-safe integer. */
export function centsToNumber(cents: string | number): number {
  const n = typeof cents === 'string' ? Number(cents) : cents
  return Number.isFinite(n) ? n : 0
}

export function centsToDisplay(cents: string | number): string {
  return formatter.format(centsToNumber(cents) / 100)
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
