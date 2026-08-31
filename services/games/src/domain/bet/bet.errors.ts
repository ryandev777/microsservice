export class InvalidBetTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBetTransitionError";
  }
}

export class AlreadyCashedOutError extends Error {
  constructor(betId: string) {
    super(`Bet ${betId} has already been cashed out or is not eligible for cashout`);
    this.name = "AlreadyCashedOutError";
  }
}

export class InvalidBetAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBetAmountError";
  }
}

export class DuplicateBetError extends Error {
  constructor(roundId: string, playerId: string) {
    super(`Player ${playerId} has already placed a bet in round ${roundId}`);
    this.name = "DuplicateBetError";
  }
}
