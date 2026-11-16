import { describe, expect, it } from "vitest";

import {
  chartGapThresholdMs,
  findLiveEvent,
  formatNextMarketTime,
  formatUpdownPrice,
  formatUpdownPriceDelta,
  getClosedHoursState,
  parseUpdownMetadata,
} from "@/lib/crypto-updown";
import {
  getWinningOutcomeLabel,
  isFinanceUpdownEvent,
  isSplitResolution,
  isUpdownEvent,
} from "@/lib/market/gamma-helpers";
import type { GammaEvent, GammaMarket, UpdownPriceFeed } from "@/lib/types/event";
import { priceFeedAdapter } from "@/lib/updown-price-feed";

function event(
  slug: string,
  metadataType: string,
  metadata: Record<string, unknown>,
): GammaEvent {
  return { slug, metadataType, metadata } as unknown as GammaEvent;
}

const HOUR = 3600;
// 2026-11-12 12:00:00 UTC
const T0 = 1794484800;

function goldSlot(start: number): GammaEvent {
  return event(`fin-metal-xau-usd-updown-1h-${start}`, "finance_updown", {
    slot_start: start,
    slot_end: start + HOUR,
    interval_minutes: 60,
    asset_key: "metal.xau/usd",
    category: "metals",
  });
}

function btcSlot(start: number): GammaEvent {
  return event(`btc-updown-1h-${start}`, "crypto_updown", {
    slot_start: start,
    slot_end: start + HOUR,
    interval_minutes: 60,
    base: "BTC",
    target: "USDT",
  });
}

const fx = (assetKey: string): UpdownPriceFeed => ({
  kind: "finance",
  assetKey,
  category: "fx",
});

describe("parseUpdownMetadata", () => {
  it("reads a crypto slot with its base/target feed", () => {
    const meta = parseUpdownMetadata(
      event("btc", "crypto_updown", {
        slot_start: T0,
        slot_end: T0 + 300,
        interval_minutes: 5,
        base: "BTC",
        target: "USDT",
        priceToBeat: "97000.5",
      }),
    );
    expect(meta).toEqual({
      feed: { kind: "crypto", base: "BTC", target: "USDT" },
      interval_minutes: 5,
      slot_start: T0,
      slot_end: T0 + 300,
      priceToBeat: "97000.5",
    });
  });

  it("reads a finance slot with its asset key and category", () => {
    const meta = parseUpdownMetadata(goldSlot(T0));
    expect(meta?.feed).toEqual({
      kind: "finance",
      assetKey: "metal.xau/usd",
      category: "metals",
    });
    expect(meta?.slot_start).toBe(T0);
    expect(meta?.slot_end).toBe(T0 + HOUR);
    expect(meta?.interval_minutes).toBe(60);
  });

  it("parses JSON-string metadata", () => {
    const e = {
      slug: "x",
      metadataType: "finance_updown",
      metadata: JSON.stringify({
        slot_start: T0,
        slot_end: T0 + HOUR,
        interval_minutes: 60,
        asset_key: "FX.USD/JPY",
        category: "fx",
      }),
    } as unknown as GammaEvent;
    expect(parseUpdownMetadata(e)?.feed).toEqual({
      kind: "finance",
      assetKey: "fx.usd/jpy",
      category: "fx",
    });
  });

  it("treats metadata with asset_key as finance even without metadataType", () => {
    const e = goldSlot(T0);
    delete e.metadataType;
    expect(parseUpdownMetadata(e)?.feed.kind).toBe("finance");
  });

  it("keeps an unknown category as null", () => {
    const meta = parseUpdownMetadata(
      event("x", "finance_updown", {
        slot_start: T0,
        slot_end: T0 + HOUR,
        interval_minutes: 60,
        asset_key: "metal.xau/usd",
        category: "metal",
      }),
    );
    expect(meta?.feed).toMatchObject({ kind: "finance", category: null });
  });

  it("rejects a finance slot without asset_key and slots without times", () => {
    expect(
      parseUpdownMetadata(
        event("x", "finance_updown", {
          slot_start: T0,
          slot_end: T0 + HOUR,
          interval_minutes: 60,
        }),
      ),
    ).toBeNull();
    expect(
      parseUpdownMetadata(event("x", "crypto_updown", { base: "BTC" })),
    ).toBeNull();
  });
});

describe("event detection", () => {
  it("routes crypto and finance Up/Down events to the Up/Down page", () => {
    expect(isUpdownEvent(btcSlot(T0))).toBe(true);
    expect(isUpdownEvent(goldSlot(T0))).toBe(true);
    expect(isFinanceUpdownEvent(goldSlot(T0))).toBe(true);
    expect(isFinanceUpdownEvent(btcSlot(T0))).toBe(false);
    expect(isUpdownEvent(event("x", "sports_soccer_fixture", {}))).toBe(false);
  });
});

describe("priceFeedAdapter", () => {
  it("reads crypto from the crypto routes and topic", () => {
    expect(
      priceFeedAdapter({ kind: "crypto", base: "BTC", target: "USDT" }),
    ).toEqual({
      routePrefix: "/crypto",
      restSymbol: "btc",
      wsTopic: "crypto_prices",
      wsSymbol: "btc/usdt",
      hasClosedHours: false,
    });
  });

  it("defaults the crypto quote to usdt", () => {
    expect(
      priceFeedAdapter({ kind: "crypto", base: "ETH", target: "" }).wsSymbol,
    ).toBe("eth/usdt");
  });

  it("reads finance from the finance routes and topic by asset key", () => {
    expect(
      priceFeedAdapter({
        kind: "finance",
        assetKey: "metal.xau/usd",
        category: "metals",
      }),
    ).toEqual({
      routePrefix: "/finance",
      restSymbol: "metal.xau/usd",
      wsTopic: "finance_prices",
      wsSymbol: "metal.xau/usd",
      hasClosedHours: true,
    });
  });
});

describe("formatUpdownPrice", () => {
  it("keeps crypto formatting", () => {
    const btc: UpdownPriceFeed = { kind: "crypto", base: "BTC", target: "USDT" };
    expect(formatUpdownPrice("97000.456", btc)).toBe("$97,000.46");
    expect(formatUpdownPrice("0.12345678", { kind: "crypto", base: "X", target: "ETH" })).toBe(
      "0.12345678",
    );
    expect(formatUpdownPriceDelta(12.4, btc)).toBe("$12");
  });

  it("formats FX in 5 decimals, JPY quotes in 3", () => {
    expect(formatUpdownPrice("1.085231", fx("fx.eur/usd"))).toBe("1.08523");
    expect(formatUpdownPrice("153.41234", fx("fx.usd/jpy"))).toBe("153.412");
    expect(formatUpdownPriceDelta(0.00042, fx("fx.eur/usd"))).toBe("0.00042");
  });

  it.each(["metals", "commodities", "stocks", "indices"] as const)(
    "formats %s in dollars with 2 decimals",
    (category) => {
      const feed: UpdownPriceFeed = {
        kind: "finance",
        assetKey: "metal.xau/usd",
        category,
      };
      expect(formatUpdownPrice("4077.952", feed)).toBe("$4,077.95");
      expect(formatUpdownPriceDelta(1.5, feed)).toBe("$1.50");
    },
  );

  it("returns non-numeric input unchanged", () => {
    expect(formatUpdownPrice("n/a", fx("fx.eur/usd"))).toBe("n/a");
  });
});

describe("getClosedHoursState", () => {
  const nowMs = (sec: number) => sec * 1000;

  it("is null while a finance slot is live", () => {
    const events = [goldSlot(T0), goldSlot(T0 + HOUR)];
    expect(getClosedHoursState(events, nowMs(T0 + 60))).toBeNull();
  });

  it("names the next slot between sessions", () => {
    // Session ends at T0 + 1h; the next slot starts at T0 + 2h (daily break).
    const events = [goldSlot(T0), goldSlot(T0 + 2 * HOUR), goldSlot(T0 + 3 * HOUR)];
    const now = nowMs(T0 + HOUR + 60);
    expect(getClosedHoursState(events, now)).toEqual({
      nextSlotStartSec: T0 + 2 * HOUR,
    });
    // findLiveEvent then picks that next slot.
    expect(findLiveEvent(events, now)?.slug).toBe(goldSlot(T0 + 2 * HOUR).slug);
  });

  it("is closed with no next slot when none is listed yet", () => {
    expect(getClosedHoursState([goldSlot(T0)], nowMs(T0 + 2 * HOUR))).toEqual({
      nextSlotStartSec: null,
    });
  });

  it("is never closed for crypto", () => {
    expect(
      getClosedHoursState([btcSlot(T0), btcSlot(T0 + 2 * HOUR)], nowMs(T0 + HOUR + 60)),
    ).toBeNull();
  });

  it("formats the next market time in UTC", () => {
    expect(formatNextMarketTime(T0 + 11 * HOUR)).toBe("Nov 12, 11:00 PM UTC");
  });
});

describe("chartGapThresholdMs", () => {
  it("breaks finance charts after 1.5 buckets and never crypto charts", () => {
    const gold = parseUpdownMetadata(goldSlot(T0))!;
    expect(chartGapThresholdMs(gold, true)).toBe(90_000);
    expect(chartGapThresholdMs(gold, false)).toBe(450_000);
    expect(chartGapThresholdMs(parseUpdownMetadata(btcSlot(T0))!, true)).toBeNull();
  });
});

describe("50-50 resolution", () => {
  const market = (outcomePrices: string, closed: boolean) =>
    ({
      outcomePrices,
      outcomes: '["Up","Down"]',
      closed,
    }) as GammaMarket;

  it("shows a settled market paying both outcomes as 50-50", () => {
    expect(isSplitResolution(market('["1","1"]', true))).toBe(true);
    expect(isSplitResolution(market('["0.5","0.5"]', true))).toBe(true);
    expect(getWinningOutcomeLabel(market('["1","1"]', true))).toBe("50-50");
  });

  it("keeps Up/Down winners and ignores open or unsettled markets", () => {
    expect(getWinningOutcomeLabel(market('["1","0"]', true))).toBe("Up");
    expect(getWinningOutcomeLabel(market('["0","1"]', true))).toBe("Down");
    expect(isSplitResolution(market('["0.5","0.5"]', false))).toBe(false);
    expect(isSplitResolution(market('["0","0"]', true))).toBe(false);
  });
});
