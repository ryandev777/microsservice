export class InvalidRoundTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRoundTransitionError";
  }
}

export class SeedNotYetRevealedError extends Error {
  constructor() {
    super("Server seed is only revealed after the round has crashed");
    this.name = "SeedNotYetRevealedError";
  }
}

export class RoundNotInBettingPhaseError extends Error {
  constructor(roundId: string) {
    super(`Round ${roundId} is not in the betting phase`);
    this.name = "RoundNotInBettingPhaseError";
  }
}

export class RoundNotRunningError extends Error {
  constructor(roundId: string) {
    super(`Round ${roundId} is not currently running`);
    this.name = "RoundNotRunningError";
  }
}

export class RoundNotYetVerifiableError extends Error {
  constructor(roundId: string) {
    super(`Round ${roundId} has not crashed yet, nothing to verify`);
    this.name = "RoundNotYetVerifiableError";
  }
}
