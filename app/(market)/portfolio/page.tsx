import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PositionsTable } from "@/components/portfolio/positions-table";
import { TradeHistory } from "@/components/portfolio/trade-history";
import { formatCurrency } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio | Polymarket",
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

      {/* Balance cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
            Total Value
          </p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(totalValue)}
          </p>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
            Cash Balance
          </p>
          <p className="text-2xl font-bold text-green">
            {formatCurrency(user?.balance ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
            Portfolio Value
          </p>
          <p className="text-2xl font-bold text-brand">
            {formatCurrency(portfolioValue)}
          </p>
        </div>
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
