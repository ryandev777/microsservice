import { describe, expect, it } from 'vitest'
import {
  centsToDisplay,
  formatMultiplier,
  MAX_BET_CENTS,
  MIN_BET_CENTS,
  potentialPayoutCents,
  reaisInputToCents,
} from './money'

describe('reaisInputToCents', () => {
  it('parses pt-BR formatted values into integer cents', () => {
    expect(reaisInputToCents('10,00')).toBe(1000)
    expect(reaisInputToCents('1.234,56')).toBe(123456)
    expect(reaisInputToCents('1')).toBe(100)
  })

  it('returns null for empty or invalid input', () => {
    expect(reaisInputToCents('')).toBeNull()
    expect(reaisInputToCents('abc')).toBeNull()
  })

  it('never produces a floating point result', () => {
    const result = reaisInputToCents('0,1')
    expect(Number.isInteger(result)).toBe(true)
  })
})

describe('centsToDisplay', () => {
  it('formats cents as BRL currency', () => {
    expect(centsToDisplay(1000)).toContain('10,00')
  })
})

describe('bet limits', () => {
  it('matches the min/max bet rules from the README', () => {
    expect(MIN_BET_CENTS).toBe(100)
    expect(MAX_BET_CENTS).toBe(100_000)
  })
})

describe('potentialPayoutCents', () => {
  it('multiplies bet by multiplier and floors to whole cents', () => {
    expect(potentialPayoutCents(1000, 2.5)).toBe(2500)
    expect(potentialPayoutCents(333, 1.111)).toBe(369)
  })
})

describe('formatMultiplier', () => {
  it('formats with two decimal places and an x suffix', () => {
    expect(formatMultiplier(1)).toBe('1.00x')
    expect(formatMultiplier(2.5)).toBe('2.50x')
  })
})
