import { createHash, createHmac, randomBytes } from "crypto";

export interface SeedPair {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

const HEX_SUBSTRING_LENGTH = 13;
const MAX_VALUE = Math.pow(2, 52);

/**
 * Provably fair crash point algorithm (HMAC_SHA256_V1), inspired by the
 * classic Bustabit approach:
 *
 *   1. hmac = HMAC_SHA256(key=serverSeed, message=`${clientSeed}:${nonce}`)
 *   2. take the first 13 hex chars (52 bits) as an integer `intValue`
 *   3. house edge is expressed as a fraction (e.g. 0.01 = 1%) and doubles as
 *      the "instant crash" (1.00x) probability: intValue % round(1/houseEdge) === 0
 *   4. otherwise crashPoint = floor((100 - houseEdge*100) * MAX / (MAX - intValue)) / 100
 *
 * This is deterministic and symmetric: anyone who knows serverSeed,
 * clientSeed, nonce and houseEdge can recompute the exact same crash point,
 * and can verify sha256(serverSeed) === serverSeedHash published before the
 * round started.
 */
export class ProvablyFairService {
  static readonly ALGORITHM_VERSION = "HMAC_SHA256_V1";

  generateSeedPair(nonce: number): SeedPair {
    const serverSeed = randomBytes(32).toString("hex");
    const clientSeed = randomBytes(16).toString("hex");
    return {
      serverSeed,
      serverSeedHash: this.hashServerSeed(serverSeed),
      clientSeed,
      nonce,
    };
  }

  hashServerSeed(serverSeed: string): string {
    return createHash("sha256").update(serverSeed).digest("hex");
  }

  calculateCrashPoint(serverSeed: string, clientSeed: string, nonce: number, houseEdge: number): number {
    const hmac = createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}`).digest("hex");
    const hexSubstring = hmac.slice(0, HEX_SUBSTRING_LENGTH);
    const intValue = parseInt(hexSubstring, 16);

    const instantCrashModulus = Math.max(1, Math.round(1 / houseEdge));
    if (intValue % instantCrashModulus === 0) {
      return 1.0;
    }

    const crashPoint = Math.floor(((100 - houseEdge * 100) * MAX_VALUE) / (MAX_VALUE - intValue)) / 100;
    return Math.max(1.0, crashPoint);
  }

  verifyCrashPoint(params: {
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    houseEdge: number;
    expectedCrashPoint: number;
  }): boolean {
    const hashMatches = this.hashServerSeed(params.serverSeed) === params.serverSeedHash;
    const recalculated = this.calculateCrashPoint(
      params.serverSeed,
      params.clientSeed,
      params.nonce,
      params.houseEdge,
    );
    return hashMatches && recalculated === params.expectedCrashPoint;
  }
}
