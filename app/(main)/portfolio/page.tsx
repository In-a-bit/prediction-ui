import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TradingBalanceCard } from "@/components/portfolio/trading-balance-card";
import { PortfolioSummaryCard } from "@/components/portfolio/portfolio-summary-card";
import { PositionsTable } from "@/components/portfolio/positions-table";
import { TradeHistory } from "@/components/portfolio/trade-history";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio | DPM",
};

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, positions, trades] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true, username: true },
    }),
    prisma.position.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.trade.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const portfolioValue = positions.reduce(
    (sum: number, pos: { shares: number; avgPrice: number }) =>
      sum + pos.shares * pos.avgPrice,
    0
  );
  const totalValue = (user?.balance ?? 0) + portfolioValue;

  return (
    <div className="space-y-6">
      {/* Portfolio header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
        <p className="text-sm text-muted">Welcome back, {user?.username}</p>
      </div>

      {/* Left: deposit / withdraw · Right: summary (50/50 on large screens) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <TradingBalanceCard />
        <PortfolioSummaryCard
          totalValue={totalValue}
          cashBalance={user?.balance ?? 0}
          portfolioValue={portfolioValue}
        />
      </div>

      {/* Positions */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-foreground">
          Open Positions
        </h2>
        <PositionsTable
          positions={positions.map((p: typeof positions[number]) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          }))}
        />
      </div>

      {/* Trade History */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-foreground">
          Trade History
        </h2>
        <TradeHistory
          trades={trades.map((t: typeof trades[number]) => ({
            ...t,
            createdAt: t.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
