import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'

function resetStore() {
  useGameStore.setState({
    phase: 'BETTING',
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
    expect(state.phase).toBe('BETTING')
    expect(state.roundId).toBe('r1')
    expect(state.multiplier).toBe(1)
    expect(state.crashPoint).toBeNull()
  })

  it('moves to running phase on round:started', () => {
    useGameStore.getState().onRoundStarted()
    expect(useGameStore.getState().phase).toBe('RUNNING')
  })

  it('updates the live multiplier on each tick', () => {
    useGameStore.getState().onMultiplierTick(1.42)
    expect(useGameStore.getState().multiplier).toBe(1.42)
  })

  it('records the crash point and prepends it to history, capped at 20', () => {
    useGameStore.setState({
      history: Array.from({ length: 20 }, (_, i) => ({
        roundId: `old-${i}`,
        crashPoint: 1,
        crashedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      })),
    })

    useGameStore.getState().onRoundCrashed({
      roundId: 'r1',
      crashPoint: 3.14,
      crashedAt: '2026-01-01T00:00:12.000Z',
      serverSeed: 'seed',
      serverSeedHash: 'hash1',
      clientSeed: 'client',
      nonce: 1,
    })

    const state = useGameStore.getState()
    expect(state.phase).toBe('CRASHED')
    expect(state.crashPoint).toBe(3.14)
    expect(state.history).toHaveLength(20)
    expect(state.history[0]?.crashPoint).toBe(3.14)
  })

  it('marks the round settled on round:settled', () => {
    useGameStore.getState().onRoundSettled({ roundId: 'r1', lostBetsCount: 2 })
    expect(useGameStore.getState().phase).toBe('SETTLED')
  })

  it('tracks a confirmed bet as pending and marks it won after cash out', () => {
    useGameStore.getState().onBetConfirmed({
      betId: 'b1',
      playerId: 'p1',
      username: 'player',
      amountCents: '1000',
    })
    expect(useGameStore.getState().liveBets[0]).toMatchObject({ status: 'CONFIRMED' })

    useGameStore.getState().onBetCashedOut({
      betId: 'b1',
      playerId: 'p1',
      username: 'player',
      multiplier: 2,
      payoutAmountCents: '2000',
    })

    const bet = useGameStore.getState().liveBets[0]
    expect(bet?.status).toBe('WON')
    expect(bet?.payoutAmountCents).toBe('2000')
  })

  it('hydrates every field from a round snapshot (REST or WS)', () => {
    useGameStore.getState().onSnapshot({
      roundId: 'snapshot-round',
      status: 'RUNNING',
      serverSeedHash: 'hash',
      bettingEndsAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:05.000Z',
      currentMultiplier: 2.3,
      activeBets: [
        { betId: 'b1', playerId: 'p1', username: 'player', amountCents: '500', status: 'CONFIRMED' },
      ],
    })

    const state = useGameStore.getState()
    expect(state.roundId).toBe('snapshot-round')
    expect(state.phase).toBe('RUNNING')
    expect(state.multiplier).toBe(2.3)
    expect(state.liveBets).toHaveLength(1)
    expect(state.liveBets[0]).toMatchObject({ betId: 'b1', amountCents: '500' })
  })
})
