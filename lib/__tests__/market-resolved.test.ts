import { describe, expect, it } from "vitest";

import { parseMarketResolvedEvent } from "@/lib/ws/market-resolved";

describe("parseMarketResolvedEvent", () => {
  it("reads a single winner", () => {
    const evt = parseMarketResolvedEvent({
      event_type: "market_resolved",
      market: "7",
      winning_asset_id: "1",
      winning_outcome: "Up",
    });
    expect(evt?.winning_outcome).toBe("Up");
    expect(evt?.split).toBe(false);
  });

  it("reads a 50-50: split, and no winner named", () => {
    const evt = parseMarketResolvedEvent({
      event_type: "market_resolved",
      market: "7",
      winning_asset_id: null,
      winning_outcome: null,
      split: true,
    });
    expect(evt?.split).toBe(true);
    expect(evt?.winning_outcome).toBeUndefined();
    expect(evt?.winning_asset_id).toBeUndefined();
  });
});
