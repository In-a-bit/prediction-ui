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

export const plaeSoccerGroup: PlaeTopicGroup = {
  label: "Soccer",
  icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
  topics: [
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
  ],
};

const plaeTopicsBySlug = new Map<string, PlaeTopic>([
  [plaeCryptoTopic.slug, plaeCryptoTopic],
  ...plaeSoccerGroup.topics.map((topic) => [topic.slug, topic] as const),
]);

export function getPlaeTopic(slug: string): PlaeTopic | undefined {
  return plaeTopicsBySlug.get(slug);
}

export function isPlaeSoccerTopic(slug: string): boolean {
  return plaeSoccerGroup.topics.some((topic) => topic.slug === slug);
}
