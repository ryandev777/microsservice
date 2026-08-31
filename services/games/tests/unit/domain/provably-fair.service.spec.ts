import { describe, expect, it } from "bun:test";
import { ProvablyFairService } from "../../../src/domain/provably-fair/provably-fair.service";

describe("ProvablyFairService", () => {
  const pf = new ProvablyFairService();
  const serverSeed = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const clientSeed = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const houseEdge = 0.01;

  it("hashes the server seed deterministically", () => {
    expect(pf.hashServerSeed(serverSeed)).toBe(
      "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
    );
  });

  it("calculates a fixed, known crash point for a given seed/nonce (regression vector)", () => {
    expect(pf.calculateCrashPoint(serverSeed, clientSeed, 1, houseEdge)).toBe(1.1);
    expect(pf.calculateCrashPoint(serverSeed, clientSeed, 2, houseEdge)).toBe(9.36);
    expect(pf.calculateCrashPoint(serverSeed, clientSeed, 3, houseEdge)).toBe(2.37);
  });

  it("is deterministic: same inputs always produce the same output", () => {
    const a = pf.calculateCrashPoint(serverSeed, clientSeed, 42, houseEdge);
    const b = pf.calculateCrashPoint(serverSeed, clientSeed, 42, houseEdge);
    expect(a).toBe(b);
  });

  it("verifyCrashPoint accepts a matching seed/hash/crashPoint combination", () => {
    const crashPoint = pf.calculateCrashPoint(serverSeed, clientSeed, 1, houseEdge);
    const ok = pf.verifyCrashPoint({
      serverSeed,
      serverSeedHash: pf.hashServerSeed(serverSeed),
      clientSeed,
      nonce: 1,
      houseEdge,
      expectedCrashPoint: crashPoint,
    });
    expect(ok).toBe(true);
  });

  it("verifyCrashPoint rejects a tampered server seed (hash mismatch)", () => {
    const crashPoint = pf.calculateCrashPoint(serverSeed, clientSeed, 1, houseEdge);
    const ok = pf.verifyCrashPoint({
      serverSeed: "c".repeat(64),
      serverSeedHash: pf.hashServerSeed(serverSeed),
      clientSeed,
      nonce: 1,
      houseEdge,
      expectedCrashPoint: crashPoint,
    });
    expect(ok).toBe(false);
  });

  it("verifyCrashPoint rejects a tampered crash point", () => {
    const ok = pf.verifyCrashPoint({
      serverSeed,
      serverSeedHash: pf.hashServerSeed(serverSeed),
      clientSeed,
      nonce: 1,
      houseEdge,
      expectedCrashPoint: 999,
    });
    expect(ok).toBe(false);
  });

  it("generateSeedPair produces a hash that matches its own server seed", () => {
    const pair = pf.generateSeedPair(7);
    expect(pf.hashServerSeed(pair.serverSeed)).toBe(pair.serverSeedHash);
  });

  it("crash point is always >= 1.00 across many random seeds (property test)", () => {
    for (let i = 0; i < 2000; i++) {
      const pair = pf.generateSeedPair(i);
      const crashPoint = pf.calculateCrashPoint(pair.serverSeed, pair.clientSeed, pair.nonce, houseEdge);
      expect(crashPoint).toBeGreaterThanOrEqual(1.0);
    }
  });
});
