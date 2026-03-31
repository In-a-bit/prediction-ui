"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TradingBalanceCard } from "@/components/portfolio/trading-balance-card";
import { PortfolioSummaryCard } from "@/components/portfolio/portfolio-summary-card";
import { PositionsTable } from "@/components/portfolio/positions-table";
import { TradeHistory } from "@/components/portfolio/trade-history";
import { useCollateralBalance } from "@/lib/hooks/use-collateral-balance";

export function PortfolioClientPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const { balanceNormalized } = useCollateralBalance();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=%2Fportfolio");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-card" />
        <div className="h-64 animate-pulse rounded-2xl border border-card-border bg-card" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const cashBalance = balanceNormalized ? Number(balanceNormalized) : 0;
  const portfolioValue = 0;
  const totalValue = cashBalance;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
        <p className="text-sm text-muted">
          Welcome back, {session?.user?.name ?? "Trader"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <TradingBalanceCard />
        <PortfolioSummaryCard
          totalValue={totalValue}
          cashBalance={cashBalance}
          portfolioValue={portfolioValue}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-foreground">Open Positions</h2>
        <PositionsTable positions={[]} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-foreground">Trade History</h2>
        <TradeHistory trades={[]} />
      </div>
    </div>
  );
}
