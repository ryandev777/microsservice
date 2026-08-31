import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'

function resetStore() {
  useGameStore.setState({
    phase: 'betting',
    roundId: null,
    bettingEndsAt: null,
    serverSeedHash: null,
    multiplier: 1,
    crashPoint: null,
    liveBets: [],
    history: [],
  })
}

describe('gameStore', () => {
  beforeEach(resetStore)

  it('starts a new betting phase on round:betting_open', () => {
    useGameStore.getState().onBettingOpen({
      roundId: 'r1',
      bettingEndsAt: '2026-01-01T00:00:10.000Z',
      serverSeedHash: 'hash1',
    })

    const state = useGameStore.getState()
    expect(state.phase).toBe('betting')
    expect(state.roundId).toBe('r1')
    expect(state.multiplier).toBe(1)
    expect(state.crashPoint).toBeNull()
  })

  it('moves to running phase on round:started', () => {
    useGameStore.getState().onRoundStarted()
    expect(useGameStore.getState().phase).toBe('running')
  })

  it('updates the live multiplier on each tick', () => {
    useGameStore.getState().onMultiplierTick(1.42)
    expect(useGameStore.getState().multiplier).toBe(1.42)
  })

  it('records the crash point and prepends it to history, capped at 20', () => {
    useGameStore.setState({
      history: Array.from({ length: 20 }, (_, i) => ({
        id: `old-${i}`,
        crashPoint: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      })),
    })

    useGameStore.getState().onRoundCrashed({
      roundId: 'r1',
      crashPoint: 3.14,
      serverSeed: 'seed',
      clientSeed: 'client',
      nonce: 1,
    })

    const state = useGameStore.getState()
    expect(state.phase).toBe('crashed')
    expect(state.crashPoint).toBe(3.14)
    expect(state.history).toHaveLength(20)
    expect(state.history[0]?.crashPoint).toBe(3.14)
  })

  it('tracks a placed bet as pending and marks it cashed out later', () => {
    useGameStore.getState().onBetPlaced({
      roundId: 'r1',
      betId: 'b1',
      username: 'player',
      amountCents: 1000,
    })
    expect(useGameStore.getState().liveBets[0]).toMatchObject({ status: 'pending' })

    useGameStore.getState().onBetCashedOut({
      roundId: 'r1',
      betId: 'b1',
      username: 'player',
      multiplier: 2,
      payoutCents: 2000,
    })

    const bet = useGameStore.getState().liveBets[0]
    expect(bet?.status).toBe('cashed_out')
    expect(bet?.payoutCents).toBe(2000)
  })

  it('hydrates from a REST snapshot only before any WS round has been set', () => {
    useGameStore.getState().hydrateFromSnapshot({
      roundId: 'snapshot-round',
      phase: 'running',
      bettingEndsAt: null,
      serverSeedHash: 'hash',
      multiplier: 2.3,
      crashPoint: null,
    })
    expect(useGameStore.getState().roundId).toBe('snapshot-round')

    useGameStore.getState().hydrateFromSnapshot({
      roundId: 'other-round',
      phase: 'betting',
      bettingEndsAt: null,
      serverSeedHash: 'hash2',
      multiplier: 1,
      crashPoint: null,
    })
    expect(useGameStore.getState().roundId).toBe('snapshot-round')
  })
})
