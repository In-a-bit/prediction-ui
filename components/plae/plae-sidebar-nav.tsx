"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  plaeCryptoTopic,
  plaeLeagueSportGroups,
  type PlaeLeagueSportGroup,
} from "@/lib/data/plae-topics";
import { usePlaeEvents } from "@/lib/hooks/use-plae-events";
import type { GammaEvent } from "@/lib/types/event";
import { cn } from "@/lib/utils";

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      className="h-4.5 w-4.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M19 9l-7 7-7-7" />
    </svg>
  );
}

const SPORT_LEAGUE_LIMIT = 100;

interface LeagueLinkData {
  slug: string;
  title: string;
}

function seriesHref(basePath: string, slug: string) {
  return `${basePath}/series/${slug}`;
}

function leaguesFromEvents(events: GammaEvent[]): LeagueLinkData[] {
  const seen = new Set<string>();
  const leagues: LeagueLinkData[] = [];
  for (const event of events) {
    const series = event.series?.[0];
    if (!series?.slug || seen.has(series.slug)) continue;
    seen.add(series.slug);
    leagues.push({ slug: series.slug, title: series.title || series.slug });
  }
  return leagues.sort((a, b) => a.title.localeCompare(b.title));
}

/** Shared topic nav for Plaee and LP surfaces. */
export function PlaeSidebarNav() {
  const pathname = usePathname();
  const basePath = pathname.startsWith("/lp") ? "/lp" : "/plaee";

  function topicHref(slug: string) {
    return `${basePath}/t/${slug}`;
  }

  function topicIsActive(slug: string) {
    return pathname === topicHref(slug);
  }

  const cryptoActive = topicIsActive(plaeCryptoTopic.slug);

  return (
    <nav className="space-y-1">
      <Link
        href={topicHref(plaeCryptoTopic.slug)}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          cryptoActive
            ? "bg-brand/10 text-brand"
            : "text-muted hover:bg-card-hover hover:text-foreground",
        )}
      >
        <NavIcon path="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        {plaeCryptoTopic.label}
      </Link>

      {plaeLeagueSportGroups.map((group) => (
        <SportLeagueGroup
          key={group.key}
          group={group}
          basePath={basePath}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}

/** Leagues (series) tagged with `tagSlug` that currently have an active event. */
function useSportLeagues(tagSlug: string) {
  const { data, isLoading } = usePlaeEvents({
    active: true,
    group_by_series: true,
    tag_slug: tagSlug,
    limit: SPORT_LEAGUE_LIMIT,
  });
  return { leagues: leaguesFromEvents(data?.events ?? []), isLoading };
}

/** One collapsible sidebar group for a sport. Hidden entirely once loaded
 * with no leagues, so an empty sport never shows its title. */
function SportLeagueGroup({
  group,
  basePath,
  pathname,
}: {
  group: PlaeLeagueSportGroup;
  basePath: string;
  pathname: string;
}) {
  const { leagues, isLoading } = useSportLeagues(group.tagSlug);
  const childActive = leagues.some(
    (league) => pathname === seriesHref(basePath, league.slug),
  );
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (isLoading || leagues.length === 0) {
    return null;
  }

  return (
    <div>
      <SportGroupToggle
        group={group}
        active={childActive}
        open={open}
        onToggle={() => setOpen((prev) => !prev)}
      />
      {open ? (
        <LeagueList
          leagues={leagues}
          icon={group.icon}
          basePath={basePath}
          pathname={pathname}
        />
      ) : null}
    </div>
  );
}

function SportGroupToggle({
  group,
  active,
  open,
  onToggle,
}: {
  group: PlaeLeagueSportGroup;
  active: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "text-brand"
          : "text-muted hover:bg-card-hover hover:text-foreground",
      )}
    >
      <NavIcon path={group.icon} />
      <span className="flex-1 text-left">{group.label}</span>
      <ChevronIcon open={open} />
    </button>
  );
}

function LeagueList({
  leagues,
  icon,
  basePath,
  pathname,
}: {
  leagues: LeagueLinkData[];
  icon: string;
  basePath: string;
  pathname: string;
}) {
  return (
    <div className="ml-3 mt-1 space-y-1 border-l border-card-border pl-3">
      {leagues.map((league) => (
        <LeagueLink
          key={league.slug}
          league={league}
          icon={icon}
          href={seriesHref(basePath, league.slug)}
          active={pathname === seriesHref(basePath, league.slug)}
        />
      ))}
    </div>
  );
}

function LeagueLink({
  league,
  icon,
  href,
  active,
}: {
  league: LeagueLinkData;
  icon: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand/10 text-brand"
          : "text-muted hover:bg-card-hover hover:text-foreground",
      )}
    >
      <NavIcon path={icon} />
      {league.title}
    </Link>
  );
}
