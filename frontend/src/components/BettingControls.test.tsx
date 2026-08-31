import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '@/stores/gameStore'
import { BettingControls } from './BettingControls'

const placeBetMutate = vi.fn()
const cashoutMutate = vi.fn()

vi.mock('@/hooks/useWallet', () => ({
  useWalletMe: () => ({ data: { id: 'w1', balanceCents: 5000 } }),
}))

vi.mock('@/hooks/useRounds', () => ({
  usePlaceBet: () => ({ mutate: placeBetMutate, isPending: false }),
  useCashout: () => ({ mutate: cashoutMutate, isPending: false }),
}))

function resetStore() {
  useGameStore.setState({
    phase: 'betting',
    roundId: 'r1',
    bettingEndsAt: new Date(Date.now() + 10_000).toISOString(),
    serverSeedHash: 'hash',
    multiplier: 1,
    crashPoint: null,
    liveBets: [],
    history: [],
  })
}

describe('BettingControls', () => {
  beforeEach(() => {
    resetStore()
    placeBetMutate.mockReset()
    cashoutMutate.mockReset()
  })

  it('disables the bet button when the amount exceeds the wallet balance', async () => {
    render(<BettingControls />)

    const input = screen.getByLabelText(/valor da aposta/i)
    await userEvent.clear(input)
    await userEvent.type(input, '100,00')

    expect(screen.getByText(/saldo insuficiente/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /apostar/i })).toBeDisabled()
  })

  it('enables cash out only while running with a pending bet', () => {
    resetStore()
    render(<BettingControls />)
    expect(screen.getByRole('button', { name: /cash out/i })).toBeDisabled()
  })

  it('calls the place bet mutation with the amount in cents', async () => {
    render(<BettingControls />)

    const input = screen.getByLabelText(/valor da aposta/i)
    await userEvent.clear(input)
    await userEvent.type(input, '20,00')
    await userEvent.click(screen.getByRole('button', { name: /apostar/i }))

    expect(placeBetMutate).toHaveBeenCalledWith({ amountCents: 2000 }, expect.anything())
  })
})
