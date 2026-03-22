import { formatCurrency } from "@/lib/utils";

type PortfolioSummaryCardProps = {
  totalValue: number;
  cashBalance: number;
  portfolioValue: number;
};

export function PortfolioSummaryCard({
  totalValue,
  cashBalance,
  portfolioValue,
}: PortfolioSummaryCardProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-card-border bg-card p-4">
      <ul className="flex flex-1 flex-col justify-center divide-y divide-card-border">
        <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Total Value
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {formatCurrency(totalValue)}
          </p>
        </li>
        <li className="flex items-center justify-between gap-3 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Cash Balance
          </p>
          <p className="text-lg font-bold tabular-nums text-green">
            {formatCurrency(cashBalance)}
          </p>
        </li>
        <li className="flex items-center justify-between gap-3 py-2.5 last:pb-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Portfolio Value
          </p>
          <p className="text-lg font-bold tabular-nums text-brand">
            {formatCurrency(portfolioValue)}
          </p>
        </li>
      </ul>
    </div>
  );
}
