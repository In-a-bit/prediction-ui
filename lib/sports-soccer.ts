import { formatVolume } from "@/lib/market/gamma-helpers";
import { getPlaeSoccerTopics, type PlaeTopic } from "@/lib/data/plae-topics";
import type { GammaEvent, GammaMarket } from "@/lib/types/event";

export const SPORTS_SOCCER_FIXTURE_METADATA_TYPE = "sports_soccer_fixture";
export const SPORTS_SOCCER_MARKET_METADATA_TYPE = "sports_soccer_market";

export type SoccerOutcomeKey = "home" | "draw" | "away";

export interface SoccerTeam {
  id?: number;
  name: string;
  logo?: string;
  code?: string;
}

export interface SoccerFixtureMetadata {
  sport?: string;
  series?: string;
  game_id?: number;
  leagues?: { name?: string; logo?: string };
  teams?: {
    home?: SoccerTeam;
    away?: SoccerTeam;
  };
  fixture?: {
    fixture?: { date?: string; timestamp?: number };
    league?: { name?: string };
  };
}

export interface SoccerMoneylineMarkets {
  home?: GammaMarket;
  draw?: GammaMarket;
  away?: GammaMarket;
}

export type SoccerMarketGroup = SoccerMoneylineMarkets;

export type SoccerMarketTab = "moneyline" | "halftime";

export const SOCCER_MARKET_TABS: {
  id: SoccerMarketTab;
  label: string;
  marketType: string;
  title: string;
}[] = [
  {
    id: "moneyline",
    label: "Game Lines",
    marketType: "moneyline",
    title: "Moneyline",
  },
  {
    id: "halftime",
    label: "Halftime Result",
    marketType: "halftime",
    title: "Halftime Result",
  },
];

export interface SoccerGameView {
  event: GammaEvent;
  metadata: SoccerFixtureMetadata;
  home: SoccerTeam;
  away: SoccerTeam;
  moneyline: SoccerMoneylineMarkets;
  kickoff: Date | null;
  leagueLabel: string;
  volume: number;
  marketCount: number;
}

function parseMetadataRecord(
  raw: unknown,
): Record<string, unknown> | null {
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

function readTeam(raw: unknown): SoccerTeam | null {
  const block = parseMetadataRecord(raw);
  if (!block || typeof block.name !== "string") return null;
  return {
    id: typeof block.id === "number" ? block.id : undefined,
    name: block.name,
    logo: typeof block.logo === "string" ? block.logo : undefined,
    code: typeof block.code === "string" ? block.code : undefined,
  };
}

export function parseSportsSoccerEventMetadata(
  event: GammaEvent,
): SoccerFixtureMetadata | null {
  const raw = parseMetadataRecord(event.metadata);
  if (!raw) return null;

  const teamsRaw = parseMetadataRecord(raw.teams);
  const home = teamsRaw ? readTeam(teamsRaw.home) : null;
  const away = teamsRaw ? readTeam(teamsRaw.away) : null;
  if (!home || !away) return null;

  const leagues = parseMetadataRecord(raw.leagues) ?? undefined;
  const fixture = parseMetadataRecord(raw.fixture) ?? undefined;

  return {
    sport: typeof raw.sport === "string" ? raw.sport : undefined,
    series: typeof raw.series === "string" ? raw.series : undefined,
    game_id: typeof raw.game_id === "number" ? raw.game_id : undefined,
    leagues: leagues
      ? {
          name: typeof leagues.name === "string" ? leagues.name : undefined,
          logo: typeof leagues.logo === "string" ? leagues.logo : undefined,
        }
      : undefined,
    teams: { home, away },
    fixture: fixture as SoccerFixtureMetadata["fixture"],
  };
}

export function parseSportsSoccerMarketMetadata(
  market: GammaMarket,
): { market_type?: string; outcome_key?: SoccerOutcomeKey } | null {
  const raw = parseMetadataRecord(market.metadata);
  if (!raw) return null;

  const marketType =
    typeof raw.market_type === "string" ? raw.market_type : undefined;
  const outcomeKey = raw.outcome_key;
  const outcome =
    outcomeKey === "home" || outcomeKey === "draw" || outcomeKey === "away"
      ? outcomeKey
      : undefined;

  return { market_type: marketType, outcome_key: outcome };
}

export function isSportsSoccerMarket(market: GammaMarket): boolean {
  return market.metadataType === SPORTS_SOCCER_MARKET_METADATA_TYPE;
}

export function isSportsSoccerFixtureEvent(event: GammaEvent): boolean {
  return event.metadataType === SPORTS_SOCCER_FIXTURE_METADATA_TYPE;
}

export function extractMoneylineMarkets(
  event: GammaEvent,
): SoccerMoneylineMarkets {
  return extractMarketsByType(event, "moneyline");
}

export function extractHalftimeMarkets(
  event: GammaEvent,
): SoccerMarketGroup {
  return extractMarketsByType(event, "halftime");
}

export function extractMarketsByType(
  event: GammaEvent,
  marketType: string,
): SoccerMarketGroup {
  const group: SoccerMarketGroup = {};

  for (const market of event.markets ?? []) {
    if (!isSportsSoccerMarket(market)) continue;
    const meta = parseSportsSoccerMarketMetadata(market);
    if (meta?.market_type !== marketType || !meta.outcome_key) continue;
    group[meta.outcome_key] = market;
  }

  return group;
}

export function resolvePlaeSoccerTopicFromEvent(
  event: GammaEvent,
): PlaeTopic | undefined {
  const tagSlugs = new Set(event.tags?.map((tag) => tag.slug) ?? []);
  return getPlaeSoccerTopics().find((topic) => tagSlugs.has(topic.slug));
}

export function pickDefaultSoccerMarket(
  group: SoccerMarketGroup,
): GammaMarket | undefined {
  return group.home ?? group.draw ?? group.away;
}

export function sumMarketGroupVolume(group: SoccerMarketGroup): number {
  let total = 0;
  for (const market of Object.values(group)) {
    if (!market) continue;
    total += market.volume_num || parseFloat(market.volume ?? "0") || 0;
  }
  return total;
}

export const SOCCER_OUTCOME_ORDER: SoccerOutcomeKey[] = ["home", "draw", "away"];

function readKickoff(metadata: SoccerFixtureMetadata, event: GammaEvent): Date | null {
  const iso =
    metadata.fixture?.fixture?.date ??
    event.startDate ??
    event.endDate;
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readLeagueLabel(metadata: SoccerFixtureMetadata): string {
  return (
    metadata.fixture?.league?.name ??
    metadata.leagues?.name ??
    "Soccer"
  );
}

function sumMarketVolume(markets: SoccerMoneylineMarkets): number {
  let total = 0;
  for (const market of Object.values(markets)) {
    if (!market) continue;
    total += market.volume_num || parseFloat(market.volume ?? "0") || 0;
  }
  return total;
}

export function buildSoccerGameView(event: GammaEvent): SoccerGameView | null {
  const metadata = parseSportsSoccerEventMetadata(event);
  if (!metadata?.teams?.home || !metadata.teams.away) return null;

  const moneyline = extractMoneylineMarkets(event);
  if (!moneyline.home && !moneyline.draw && !moneyline.away) return null;

  const volume = event.volume || sumMarketVolume(moneyline);

  return {
    event,
    metadata,
    home: metadata.teams.home,
    away: metadata.teams.away,
    moneyline,
    kickoff: readKickoff(metadata, event),
    leagueLabel: readLeagueLabel(metadata),
    volume,
    marketCount: event.markets?.length ?? 0,
  };
}

export function teamAbbrev(team: SoccerTeam): string {
  const code = team.code?.trim();
  if (code) return code.toUpperCase();
  return team.name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
}

export function formatYesPriceCents(market: GammaMarket | undefined): string {
  if (!market?.outcomePrices) return "—";
  try {
    const prices = JSON.parse(market.outcomePrices) as string[];
    const cents = parseFloat(prices[0]) * 100;
    if (!Number.isFinite(cents)) return "—";
    if (Number.isInteger(cents)) return `${cents}¢`;
    return `${parseFloat(cents.toFixed(1))}¢`;
  } catch {
    return "—";
  }
}

export function formatFixtureTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatFixtureDateShort(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export function formatKickoffCountdown(date: Date | null): string | null {
  if (!date) return null;
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return null;

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatFixtureDateHeader(date: Date | null): string {
  if (!date) return "Upcoming";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

export function formatGameVolume(volume: number): string {
  return `${formatVolume(volume)} Vol.`;
}

export function groupGamesByDate(
  games: SoccerGameView[],
): { label: string; games: SoccerGameView[] }[] {
  const groups = new Map<string, SoccerGameView[]>();

  for (const game of games) {
    const label = formatFixtureDateHeader(game.kickoff);
    const bucket = groups.get(label) ?? [];
    bucket.push(game);
    groups.set(label, bucket);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    games: items,
  }));
}
