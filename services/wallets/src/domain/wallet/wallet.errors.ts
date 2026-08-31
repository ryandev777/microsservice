export class InsufficientFundsError extends Error {
  constructor(readonly walletId: string) {
    super(`Wallet ${walletId} does not have sufficient funds for this operation`);
    this.name = "InsufficientFundsError";
  }
}

export class WalletAlreadyExistsError extends Error {
  constructor(readonly playerId: string) {
    super(`Wallet already exists for player ${playerId}`);
    this.name = "WalletAlreadyExistsError";
  }
}

export class WalletNotFoundError extends Error {
  constructor(readonly identifier: string) {
    super(`Wallet not found: ${identifier}`);
    this.name = "WalletNotFoundError";
  }
}
