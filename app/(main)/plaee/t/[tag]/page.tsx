import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { PlaeEventGrid } from "@/components/plae/plae-event-grid";
import { PlaeSoccerGameList } from "@/components/plae/plae-soccer-game-list";
import { getPlaeTopic, isPlaeSoccerTopic } from "@/lib/data/plae-topics";

interface PlaeTopicPageProps {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({
  params,
}: PlaeTopicPageProps): Promise<Metadata> {
  const { tag } = await params;
  const topic = getPlaeTopic(tag);

  return {
    title: topic ? `${topic.label} | Plaee | DPM` : "Plaee | DPM",
  };
}

export default async function PlaeTopicPage({ params }: PlaeTopicPageProps) {
  const { tag } = await params;
  const topic = getPlaeTopic(tag);

  if (!topic) {
    notFound();
  }

  return (
    <>
      <section className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted">
          <Link href="/plaee" className="transition-colors hover:text-foreground">
            Plaee
          </Link>
          <span>/</span>
          <span className="text-foreground">{topic.label}</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">{topic.label}</h1>
        <p className="text-sm text-muted">
          {isPlaeSoccerTopic(tag)
            ? "Soccer prediction markets — moneyline prices for each match."
            : `Prediction markets tagged with ${topic.label.toLowerCase()}.`}
        </p>
      </section>

      <section>
        {isPlaeSoccerTopic(tag) ? (
          <PlaeSoccerGameList tagSlug={tag} />
        ) : (
          <PlaeEventGrid
            tagSlug={topic.slug}
            groupBySeries={topic.groupBySeries}
          />
        )}
      </section>
    </>
  );
}
