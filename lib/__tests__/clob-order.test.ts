import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import { to1e6, decimalToMicro, buildOrderFields } from "../clob-order";

// Node 18 doesn't expose globalThis.crypto without a flag; polyfill for tests.
if (!globalThis.crypto) {
  // @ts-expect-error - assign WebCrypto to globalThis for randomSalt() tests
  globalThis.crypto = webcrypto;
}

describe("to1e6", () => {
  it("preserves 6 decimal places exactly", () => {
    expect(to1e6(1.123456)).toBe("1123456");
  });

  it("does not round 1.999999 up to 2000000", () => {
    expect(to1e6(1.999999)).toBe("1999999");
  });

  it("handles whole numbers", () => {
    expect(to1e6(10)).toBe("10000000");
  });

  it("handles zero", () => {
    expect(to1e6(0)).toBe("0");
  });

  it("handles small values", () => {
    expect(to1e6(0.000001)).toBe("1");
  });

  it("truncates beyond 6 decimals", () => {
    expect(to1e6(1.1234567)).toBe("1123456");
  });

  it("handles 0.5 price", () => {
    expect(to1e6(0.5)).toBe("500000");
  });

  it("handles 0.49 price exactly (no FP drift)", () => {
    // 0.49 in IEEE-754 is 0.4899999999999999911... — naive Math.trunc(0.49 * 1e6)
    // could return 489999 instead of 490000. Verify our string-based path is stable.
    expect(to1e6(0.49)).toBe("490000");
  });

  it("handles 0.07 price exactly (no FP drift)", () => {
    expect(to1e6(0.07)).toBe("70000");
  });

  it("accepts numeric strings without going through Number", () => {
    expect(to1e6("10.123456")).toBe("10123456");
    expect(to1e6("0.49")).toBe("490000");
  });
});

describe("decimalToMicro", () => {
  it("returns BigInt for precise BigInt arithmetic downstream", () => {
    expect(decimalToMicro(0.49)).toBe(490000n);
    expect(decimalToMicro(10.123456)).toBe(10123456n);
  });
});

describe("buildOrderFields", () => {
  const MAKER = "0x1234567890abcdef1234567890abcdef12345678";

  it("BUY: takerAmount (shares) preserves 1.999999 exactly", () => {
    const fields = buildOrderFields(
      { side: 0, tokenId: "token123", shares: 1.999999, price: 0.5 },
      MAKER,
    );
    // takerAmount = shares in 1e6 = 1999999
    expect(fields.takerAmount).toBe("1999999");
    // makerAmount = collateral = shares * price = 1.999999 * 0.5 = 0.9999995
    // truncated to 6 decimals = 999999
    expect(fields.makerAmount).toBe("999999");
  });

  it("BUY: takerAmount preserves 1.123456 exactly", () => {
    const fields = buildOrderFields(
      { side: 0, tokenId: "token123", shares: 1.123456, price: 0.5 },
      MAKER,
    );
    expect(fields.takerAmount).toBe("1123456");
    expect(fields.makerAmount).toBe("561728");
  });

  it("SELL: makerAmount (shares) preserves 1.999999 exactly", () => {
    const fields = buildOrderFields(
      { side: 1, tokenId: "token123", shares: 1.999999, price: 0.5 },
      MAKER,
    );
    // makerAmount = shares in 1e6 = 1999999
    expect(fields.makerAmount).toBe("1999999");
    // takerAmount = collateral = 0.9999995 → 999999
    expect(fields.takerAmount).toBe("999999");
  });

  it("BUY at various prices preserves share precision", () => {
    const testCases = [
      { shares: 1.999999, price: 0.33, expectedShares: "1999999" },
      { shares: 1.999999, price: 0.67, expectedShares: "1999999" },
      { shares: 1.999999, price: 0.01, expectedShares: "1999999" },
      { shares: 1.999999, price: 0.99, expectedShares: "1999999" },
      { shares: 16.666667, price: 0.5, expectedShares: "16666667" },
    ];

    for (const tc of testCases) {
      const fields = buildOrderFields(
        { side: 0, tokenId: "t", shares: tc.shares, price: tc.price },
        MAKER,
      );
      expect(fields.takerAmount).toBe(tc.expectedShares);
    }
  });

  it("BUY: implied price equals limit price exactly when shares are tick-aligned", () => {
    // With tick = 0.01 (price has 2 decimals), shares max 4 decimals.
    // 0.49 * 10.1234 = 4.960466 USDC, exactly representable in 6dp.
    const fields = buildOrderFields(
      { side: 0, tokenId: "t", shares: 10.1234, price: 0.49 },
      MAKER,
    );
    expect(fields.makerAmount).toBe("4960466");
    expect(fields.takerAmount).toBe("10123400");
    // Implied price = 4960466 / 10123400 = 0.49 exactly (49/100 ratio)
    expect(BigInt(fields.makerAmount) * 100n).toBe(BigInt(fields.takerAmount) * 49n);
  });

  it("BUY: 0.49 price with 6dp shares produces stable maker/taker (matches manual BigInt math)", () => {
    // The user's reported case: shares=10.123456, price=0.49.
    // shares is too granular for tick=0.01 (would be snapped by the UI), but
    // the order builder must still be deterministic and FP-drift-free here.
    const fields = buildOrderFields(
      { side: 0, tokenId: "t", shares: 10.123456, price: 0.49 },
      MAKER,
    );
    // 490000 * 10123456 / 1_000_000 = 4_960_493 (BigInt truncating divide)
    expect(fields.makerAmount).toBe("4960493");
    expect(fields.takerAmount).toBe("10123456");
  });

  it("SELL: shares=10.1234 at price=0.49 yields exact implied price", () => {
    const fields = buildOrderFields(
      { side: 1, tokenId: "t", shares: 10.1234, price: 0.49 },
      MAKER,
    );
    expect(fields.makerAmount).toBe("10123400");
    expect(fields.takerAmount).toBe("4960466");
    expect(BigInt(fields.takerAmount) * 100n).toBe(BigInt(fields.makerAmount) * 49n);
  });
});
