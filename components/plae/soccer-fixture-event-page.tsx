"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { MarketOpenOrders } from "@/components/market/market-open-orders";
import { MarketSidePanel } from "@/components/market/market-side-panel";
import { OrderBookView } from "@/components/market/order-book";
import { TradeTicker } from "@/components/market/trade-ticker";
import { SoccerFixtureMatchupHeader } from "@/components/plae/soccer-fixture-matchup-header";
import { SoccerMoneylinePriceChart } from "@/components/plae/soccer-moneyline-price-chart";
import { SoccerOutcomeButtons } from "@/components/plae/soccer-outcome-buttons";
import {
  formatGameVolume,
  extractHalftimeMarkets,
  extractMoneylineMarkets,
  parseSportsSoccerEventMetadata,
  pickDefaultSoccerMarket,
  resolvePlaeSoccerTopicFromEvent,
  SOCCER_MARKET_TABS,
  sumMarketGroupVolume,
  type SoccerMarketTab,
} from "@/lib/sports-soccer";
import {
  parseOutcomes,
  parsePrices,
  parseTokenIds,
} from "@/lib/market/gamma-helpers";
import type { GammaEvent, GammaMarket } from "@/lib/types/event";
import { cn } from "@/lib/utils";

function marketGroupForTab(event: GammaEvent, tab: SoccerMarketTab) {
  return tab === "moneyline"
    ? extractMoneylineMarkets(event)
    : extractHalftimeMarkets(event);
}

function tabConfig(tab: SoccerMarketTab) {
  return SOCCER_MARKET_TABS.find((item) => item.id === tab)!;
}

export function SoccerFixtureEventPage({ event }: { event: GammaEvent }) {
  const metadata = parseSportsSoccerEventMetadata(event);
  const topic = resolvePlaeSoccerTopicFromEvent(event);
  const moneyline = useMemo(() => extractMoneylineMarkets(event), [event]);
  const halftime = useMemo(() => extractHalftimeMarkets(event), [event]);

  const [marketTab, setMarketTab] = useState<SoccerMarketTab>("moneyline");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(
    null,
  );
  const [tradeOutcome, setTradeOutcome] = useState<"yes" | "no">("yes");

  const activeGroup = marketTab === "moneyline" ? moneyline : halftime;
  const activeTab = tabConfig(marketTab);
  const topicHref = topic ? `/plaee/t/${topic.slug}` : "/plaee";

  useEffect(() => {
    const group = marketGroupForTab(event, marketTab);
    const defaultMarket = pickDefaultSoccerMarket(group);
    setSelectedMarketId(defaultMarket ? String(defaultMarket.id) : null);
  }, [marketTab, event]);

  const selectedMarket = useMemo(() => {
    const markets = Object.values(activeGroup).filter(Boolean) as GammaMarket[];
    return (
      markets.find((market) => String(market.id) === selectedMarketId) ??
      pickDefaultSoccerMarket(activeGroup)
    );
  }, [activeGroup, selectedMarketId]);

  if (!metadata?.teams?.home || !metadata.teams.away) {
    return null;
  }

  const { home, away } = metadata.teams;
  const kickoff = metadata.fixture?.fixture?.date
    ? new Date(metadata.fixture.fixture.date)
    : null;
  const groupVolume = sumMarketGroupVolume(activeGroup);
  const tokenIds = selectedMarket ? parseTokenIds(selectedMarket) : [];
  const yesTokenId = tokenIds[0];
  const noTokenId = tokenIds[1];
  const { yes: yesPrice, no: noPrice } = selectedMarket
    ? parsePrices(selectedMarket)
    : { yes: 50, no: 50 };
  const outcomeLabels = parseOutcomes(selectedMarket);
  const orderBookTokenId = tradeOutcome === "yes" ? yesTokenId : noTokenId;

  return (
    <div>
      <nav className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link href="/plaee" className="transition-colors hover:text-foreground">
          Plaee
        </Link>
        <span>/</span>
        <Link href={topicHref} className="transition-colors hover:text-foreground">
          {topic?.label ?? "Soccer"}
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">Game</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SoccerFixtureMatchupHeader home={home} away={away} kickoff={kickoff} />

          <div>
            <div className="mt-5 pl-5 flex gap-6">
              {SOCCER_MARKET_TABS.map((tab) => {
                const group = marketGroupForTab(event, tab.id);
                const hasMarkets = Boolean(pickDefaultSoccerMarket(group));
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={!hasMarkets}
                    onClick={() => setMarketTab(tab.id)}
                    className={cn(
                      "border-b-2 pb-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      marketTab === tab.id
                        ? "border-brand text-foreground"
                        : "border-transparent text-muted hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <section className="rounded-2xl border border-card-border bg-card p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {activeTab.title}
                </h1>
                <p className="mt-1 text-sm text-muted">
                  {formatGameVolume(groupVolume)}
                </p>
              </div>
              <SoccerOutcomeButtons
                group={activeGroup}
                home={home}
                away={away}
                selectedMarketId={
                  selectedMarket ? String(selectedMarket.id) : null
                }
                onSelect={(market) => setSelectedMarketId(String(market.id))}
              />
            </div>

            <OrderBookView
              key={orderBookTokenId ?? selectedMarketId ?? "book"}
              tokenId={orderBookTokenId}
            />
            </section>
          </div>

          <MarketOpenOrders yesTokenId={yesTokenId} noTokenId={noTokenId} />

          <section className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-muted">
              Price History - Moneyline
            </h2>
            <SoccerMoneylinePriceChart
              moneyline={moneyline}
              home={home}
              away={away}
            />
          </section>

          <section className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-muted">
              Recent Activity
            </h2>
            <TradeTicker
              conditionId={selectedMarket?.conditionId}
              tokenIds={tokenIds.length > 0 ? tokenIds : undefined}
            />
          </section>
        </div>

        <div className="lg:sticky lg:top-36 lg:self-start">
          <MarketSidePanel
            market={selectedMarket}
            event={event}
            yesTokenId={yesTokenId}
            noTokenId={noTokenId}
            initialYesPrice={yesPrice}
            initialNoPrice={noPrice}
            outcomeLabels={outcomeLabels}
            tickSize={selectedMarket?.orderPriceMinTickSize ?? 0.01}
            minOrderSize={selectedMarket?.orderMinSize ?? 1}
            onOutcomeChange={setTradeOutcome}
          />
        </div>
      </div>
    </div>
  );
}
