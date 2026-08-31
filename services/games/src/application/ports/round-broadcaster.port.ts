export const ROUND_BROADCASTER = Symbol("ROUND_BROADCASTER");

export interface RoundBroadcaster {
  broadcastToRound(roundId: string, event: string, payload: Record<string, unknown>): void;
  emitToPlayer(playerId: string, event: string, payload: Record<string, unknown>): void;
}
