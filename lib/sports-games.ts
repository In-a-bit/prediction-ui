// Generic sports-game builder used by the multi-sport series page
// (see components/plae/plae-soccer-series-page.tsx). Soccer, hockey,
// basketball, baseball and NFL games all share the same event metadata
// shape (teams.{home,away}.{id,name,logo}, leagues.name, game_id — see
// prediction-go/apps/backoffice/internal/sportsapi/*/metadata.go) but
// differ in how their markets are shaped:
//   - soccer: three markets, outcome_key "home" | "draw" | "away".
//   - hockey/basketball/baseball/nfl: one "moneyline" market whose two
//     outcomePrices are [home, away] (see the sport_market_types seed
//     migrations — "one market whose two outcomes are the team names").
import type { GammaEvent, GammaMarket } from "@/lib/types/event";

export type SportsOutcomeKey = "home" | "draw" | "away";

const GAME_EVENT_METADATA_TYPES = new Set([
  "sports_soccer_fixture",
  "sports_hockey_game",
  "sports_basketball_game",
  "sports_baseball_game",
  "sports_nfl_game",
]);

const GAME_MARKET_METADATA_TYPES = new Set([
  "sports_soccer_market",
  "sports_hockey_market",
  "sports_basketball_market",
  "sports_baseball_market",
  "sports_nfl_market",
]);

export interface SportsTeam {
  id?: number;
  name: string;
  logo?: string;
  code?: string;
}

// One outcome button: `priceIndex` selects which entry of the market's
// `outcomePrices` array is this outcome's price (soccer's three markets
// each have their own single price at index 0; a 2-way sport shares one
// market, home at index 0 and away at index 1).
export interface SportsOutcome {
  key: SportsOutcomeKey;
  market: GammaMarket | undefined;
  priceIndex: number;
}

export interface SportsGameView {
  event: GammaEvent;
  home: SportsTeam;
  away: SportsTeam;
  kickoff: Date | null;
  leagueLabel: string;
  volume: number;
  marketCount: number;
  outcomes: SportsOutcome[];
}

function parseMetadataRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

function readTeam(raw: unknown): SportsTeam | null {
  const block = parseMetadataRecord(raw);
  if (!block || typeof block.name !== "string") return null;
  return {
    id: typeof block.id === "number" ? block.id : undefined,
    name: block.name,
    logo: typeof block.logo === "string" ? block.logo : undefined,
    code: typeof block.code === "string" ? block.code : undefined,
  };
}

function readTeams(
  raw: Record<string, unknown>,
): { home: SportsTeam; away: SportsTeam } | null {
  const teamsRaw = parseMetadataRecord(raw.teams);
  const home = teamsRaw ? readTeam(teamsRaw.home) : null;
  const away = teamsRaw ? readTeam(teamsRaw.away) : null;
  if (!home || !away) return null;
  return { home, away };
}

function readLeagueLabel(raw: Record<string, unknown>): string {
  const leagues = parseMetadataRecord(raw.leagues);
  const name = leagues && typeof leagues.name === "string" ? leagues.name : undefined;
  return name ?? "Game";
}

function readKickoff(event: GammaEvent): Date | null {
  const iso = event.startTime ?? event.startDate ?? event.endDate;
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function marketOutcomeKey(market: GammaMarket): string | undefined {
  const meta = parseMetadataRecord(market.metadata);
  return typeof meta?.outcome_key === "string" ? meta.outcome_key : undefined;
}

// Soccer shape: one market per outcome_key ("home" | "draw" | "away").
function buildThreeWayOutcomes(markets: GammaMarket[]): SportsOutcome[] {
  const byKey = new Map<SportsOutcomeKey, GammaMarket>();
  for (const market of markets) {
    const key = marketOutcomeKey(market);
    if (key === "home" || key === "draw" || key === "away") {
      byKey.set(key, market);
    }
  }
  return (["home", "draw", "away"] as SportsOutcomeKey[]).map((key) => ({
    key,
    market: byKey.get(key),
    priceIndex: 0,
  }));
}

// 2-way shape: a single "moneyline" market; outcomePrices[0]/[1] are the
// home/away prices respectively.
function buildTwoWayOutcomes(markets: GammaMarket[]): SportsOutcome[] {
  const market = markets.find((m) => marketOutcomeKey(m) === "moneyline");
  return [
    { key: "home", market, priceIndex: 0 },
    { key: "away", market, priceIndex: 1 },
  ];
}

function buildOutcomes(event: GammaEvent): SportsOutcome[] {
  const markets = (event.markets ?? []).filter(
    (market) => !!market.metadataType && GAME_MARKET_METADATA_TYPES.has(market.metadataType),
  );
  const threeWay = buildThreeWayOutcomes(markets);
  if (threeWay.some((outcome) => outcome.market)) return threeWay;
  return buildTwoWayOutcomes(markets);
}

function sumOutcomeVolume(outcomes: SportsOutcome[]): number {
  const counted = new Set<GammaMarket>();
  let total = 0;
  for (const outcome of outcomes) {
    if (!outcome.market || counted.has(outcome.market)) continue;
    counted.add(outcome.market);
    total += outcome.market.volume_num || parseFloat(outcome.market.volume ?? "0") || 0;
  }
  return total;
}

export function buildSportsGameView(event: GammaEvent): SportsGameView | null {
  if (!event.metadataType || !GAME_EVENT_METADATA_TYPES.has(event.metadataType)) {
    return null;
  }
  const raw = parseMetadataRecord(event.metadata);
  const teams = raw ? readTeams(raw) : null;
  if (!teams) return null;

  const outcomes = buildOutcomes(event);
  if (!outcomes.some((outcome) => outcome.market)) return null;

  return {
    event,
    home: teams.home,
    away: teams.away,
    kickoff: readKickoff(event),
    leagueLabel: raw ? readLeagueLabel(raw) : "Game",
    volume: event.volume || sumOutcomeVolume(outcomes),
    marketCount: event.markets?.length ?? 0,
    outcomes,
  };
}

export function formatOutcomePriceCents(
  market: GammaMarket | undefined,
  index: number,
): string {
  if (!market?.outcomePrices) return "—";
  try {
    const prices = JSON.parse(market.outcomePrices) as string[];
    const cents = parseFloat(prices[index]) * 100;
    if (!Number.isFinite(cents)) return "—";
    if (Number.isInteger(cents)) return `${cents}¢`;
    return `${parseFloat(cents.toFixed(1))}¢`;
  } catch {
    return "—";
  }
}
