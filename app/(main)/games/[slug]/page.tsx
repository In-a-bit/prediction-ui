import Link from "next/link";
import { notFound } from "next/navigation";
import { casinoGames } from "@/lib/data/casino-games";
import type { Metadata } from "next";

interface GamePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: GamePageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = casinoGames.find((g) => g.id === slug);
  return {
    title: game ? `${game.title} | DPM` : "Game | DPM",
  };
}

export default async function GamePage({ params }: GamePageProps) {
  const { slug } = await params;
  const game = casinoGames.find((g) => g.id === slug);

  if (!game) notFound();

  return (
    <div className="flex flex-col items-center justify-center py-20">
      {/* Icon */}
      <div
        className={`mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br ${game.gradient}`}
      >
        <svg
          className="h-12 w-12 text-white/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={game.icon} />
        </svg>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-foreground">{game.title}</h1>
      <p className="mb-1 text-sm text-muted">{game.description}</p>
      <span className="mb-8 inline-block rounded-lg bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
        Coming Soon
      </span>

      <Link
        href="/"
        className="rounded-xl border border-card-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-card-hover"
      >
        &larr; Back to Casino
      </Link>
    </div>
  );
}
