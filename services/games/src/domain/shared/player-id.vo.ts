export class InvalidPlayerIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPlayerIdError";
  }
}

/**
 * PlayerId wraps the Keycloak JWT `sub` claim.
 */
export class PlayerId {
  private constructor(private readonly value: string) {}

  static from(value: string): PlayerId {
    if (!value || value.trim().length === 0) {
      throw new InvalidPlayerIdError("Player id cannot be empty");
    }
    return new PlayerId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: PlayerId): boolean {
    return this.value === other.value;
  }
}
