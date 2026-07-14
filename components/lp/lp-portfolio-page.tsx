"use client";

import { TradingBalanceCard } from "@/components/portfolio/trading-balance-card";
import { PortfolioSummaryCard } from "@/components/portfolio/portfolio-summary-card";
import { PositionsTable } from "@/components/portfolio/positions-table";
import { OpenOrders } from "@/components/portfolio/open-orders";
import { PortfolioTabs } from "@/components/portfolio/portfolio-tabs";
import { TradeHistory } from "@/components/portfolio/trade-history";
import { useTrading } from "@/components/providers/trading-provider";
import { useCollateralBalance } from "@/lib/hooks/use-collateral-balance";
import { useLpConnectApi } from "@/components/lp/lp-demo-providers";

export function LpPortfolioPage() {
  const { walletAddress, eoaAddress } = useTrading();
  const { pub } = useLpConnectApi();
  const { balanceNormalized } = useCollateralBalance();

  const cashBalance = balanceNormalized ? Number(balanceNormalized) : 0;
  const connected = Boolean(pub?.connected && walletAddress);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
        <p className="text-sm text-muted">
          {connected
            ? `LP · ${eoaAddress ?? walletAddress}`
            : "Connect a liquidity provider to view balances and orders."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <TradingBalanceCard />
        <PortfolioSummaryCard
          totalValue={cashBalance}
          cashBalance={cashBalance}
          portfolioValue={0}
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
