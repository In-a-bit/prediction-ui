export interface PlaeTopic {
  slug: string;
  label: string;
  groupBySeries: boolean;
}

export interface PlaeTopicGroup {
  label: string;
  icon: string;
  topics: PlaeTopic[];
}

export const plaeCryptoTopic: PlaeTopic = {
  slug: "crypto",
  label: "Crypto",
  groupBySeries: true,
};

const plaeSoccerStaticTopics: PlaeTopic[] = [
  {
    slug: "world-cup",
    label: "World Cup",
    groupBySeries: false,
  },
  {
    slug: "friendlies",
    label: "Friendlies",
    groupBySeries: false,
  },
];

export const plaeSoccerGroup: PlaeTopicGroup = {
  label: "Soccer",
  icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
  topics: plaeSoccerStaticTopics,
};

/** Sidebar group backed by leagues (series): one collapsible menu per sport,
 * listing that sport's series as links, filtered by `tagSlug`. */
export interface PlaeLeagueSportGroup {
  key: string;
  label: string;
  icon: string;
  tagSlug: string;
}

const BASEBALL_ICON =
  "M12,3A9,9 0 1,0 12,21A9,9 0 1,0 12,3M6 7C9 9.5 9 14.5 6 17M18 7C15 9.5 15 14.5 18 17";
const HOCKEY_ICON = "M16 3L9 18L5 19.5M3 19.5H7V21H3Z";
const FOOTBALL_ICON =
  "M12,4C17,4 20,8 20,12C20,16 17,20 12,20C7,20 4,16 4,12C4,8 7,4 12,4Z M12 8V16M10 10H14M10 12.5H14M10 15H14";
const BASKETBALL_ICON =
  "M12,3A9,9 0 1,0 12,21A9,9 0 1,0 12,3M12 3V21M3 12H21M5.64 5.64C8.09 8.09 8.09 15.91 5.64 18.36M18.36 5.64C15.91 8.09 15.91 15.91 18.36 18.36";

/** League-listing sidebar groups, in sidebar order. Each `tagSlug` is the
 * gamma-api tag that marks an event as belonging to that sport. */
export const plaeLeagueSportGroups: PlaeLeagueSportGroup[] = [
  { key: "soccer", label: "Soccer", icon: plaeSoccerGroup.icon, tagSlug: "soccer" },
  { key: "baseball", label: "Baseball", icon: BASEBALL_ICON, tagSlug: "baseball" },
  { key: "hockey", label: "Hockey", icon: HOCKEY_ICON, tagSlug: "hockey" },
  { key: "nfl", label: "Football", icon: FOOTBALL_ICON, tagSlug: "nfl" },
  { key: "basketball", label: "Basketball", icon: BASKETBALL_ICON, tagSlug: "basketball" },
];

function readDynamicSportTopic(): PlaeTopic | undefined {
  const slug =
    process.env.NEXT_PUBLIC_DYNAMIC_SPORT_TAG?.trim() ||
    process.env.DYNAMIC_SPORT_TAG?.trim();
  const label =
    process.env.NEXT_PUBLIC_DYNAMIC_SPORT_TEXT?.trim() ||
    process.env.DYNAMIC_SPORT_TEXT?.trim();

  if (!slug || !label) {
    return undefined;
  }

  return {
    slug,
    label,
    groupBySeries: false,
  };
}

/** Soccer sidebar links: static topics plus optional env-configured tag. */
export function getPlaeSoccerTopics(): PlaeTopic[] {
  const dynamic = readDynamicSportTopic();
  if (!dynamic) {
    return plaeSoccerStaticTopics;
  }
  return [...plaeSoccerStaticTopics, dynamic];
}

export function getPlaeTopic(slug: string): PlaeTopic | undefined {
  if (slug === plaeCryptoTopic.slug) {
    return plaeCryptoTopic;
  }
  return getPlaeSoccerTopics().find((topic) => topic.slug === slug);
}

export function isPlaeSoccerTopic(slug: string): boolean {
  return getPlaeSoccerTopics().some((topic) => topic.slug === slug);
}
