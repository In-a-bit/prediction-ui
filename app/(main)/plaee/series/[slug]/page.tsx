import { PlaeSoccerSeriesPage } from "@/components/plae/plae-soccer-series-page";

interface PlaeSeriesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PlaeSeriesPage({ params }: PlaeSeriesPageProps) {
  const { slug } = await params;
  return <PlaeSoccerSeriesPage slug={slug} />;
}
