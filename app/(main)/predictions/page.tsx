import { Suspense } from "react";
import { TrendingCarousel } from "@/components/market/trending-carousel";
import { EventGrid } from "@/components/market/event-grid";
import { fetchEvents } from "@/lib/api/gamma";

interface PredictionsPageProps {
  searchParams: Promise<{ tag?: string; q?: string }>;
}

export default async function PredictionsPage({
  searchParams,
}: PredictionsPageProps) {
  const { tag, q } = await searchParams;

  const [events, trending] = await Promise.all([
    fetchEvents({
      active: true,
      closed: false,
      limit: q ? 100 : 21,
      order: "volume24hr",
      ascending: false,
      tag_slug: tag,
    }),
    fetchEvents({
      active: true,
      closed: false,
      limit: 8,
      order: "volume24hr",
      ascending: false,
    }),
  ]);

  return (
    <>
      {/* Trending */}
      <section className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <svg
            className="h-5 w-5 text-brand"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h2 className="text-lg font-bold text-foreground">Trending</h2>
        </div>
        <TrendingCarousel events={trending} />
      </section>

      {/* Markets Grid */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-foreground">Markets</h2>
        <Suspense>
          <EventGrid initialEvents={events} tag={tag} searchQuery={q} />
        </Suspense>
      </section>
    </>
  );
}
