import { describe, it, expect } from "vitest";
import { to1e6, buildOrderFields } from "../clob-order";

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
});
