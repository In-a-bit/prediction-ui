"use client";

import { TradingBalanceCard } from "@/components/portfolio/trading-balance-card";
import { PortfolioSummaryCard } from "@/components/portfolio/portfolio-summary-card";
import { PositionsTable } from "@/components/portfolio/positions-table";
import { OpenOrders } from "@/components/portfolio/open-orders";
import { TradeHistory } from "@/components/portfolio/trade-history";
import { PortfolioTabs } from "@/components/portfolio/portfolio-tabs";
import { useCollateralBalance } from "@/lib/hooks/use-collateral-balance";

export function PortfolioClientPage() {
  const { balanceNormalized } = useCollateralBalance();

  const cashBalance = balanceNormalized ? Number(balanceNormalized) : 0;
  const portfolioValue = 0;
  const totalValue = cashBalance;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
        <p className="text-sm text-muted">Your trading balance and positions</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <TradingBalanceCard />
        <PortfolioSummaryCard
          totalValue={totalValue}
          cashBalance={cashBalance}
          portfolioValue={portfolioValue}
        />
      </div>

      <PortfolioTabs
        positionsContent={<PositionsTable />}
        openOrdersContent={<OpenOrders />}
        historyContent={<TradeHistory trades={[]} />}
      />
    </div>
  );
}
