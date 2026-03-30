"use client";

import { useMidpoint } from "@/lib/hooks/use-prices";

export function LivePrices({
  yesTokenId,
  noTokenId,
  initialYesPrice,
  initialNoPrice,
}: {
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
  initialYesPrice: number;
  initialNoPrice: number;
}) {
  const { data: yesMid } = useMidpoint(yesTokenId);
  const { data: noMid } = useMidpoint(noTokenId);
  const yesPrice = yesMid ? Math.round(yesMid * 100) : initialYesPrice;
  const noPrice = noMid ? Math.round(noMid * 100) : initialNoPrice;

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-green">{yesPrice}¢</span>
        <span className="text-sm text-muted">Yes</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-red">{noPrice}¢</span>
        <span className="text-sm text-muted">No</span>
      </div>
    </>
  );
}
