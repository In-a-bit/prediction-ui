import { headers } from "next/headers";

import { MarketWSProvider } from "@/components/providers/market-ws-provider";
import { predictionGoMarketWsUrlForServer } from "@/lib/prediction-go";

export default async function PlaeEventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:2030";
  const forwardedProto = h.get("x-forwarded-proto");
  const publicMarketWsUrl = predictionGoMarketWsUrlForServer(host, forwardedProto);

  return (
    <MarketWSProvider wsUrl={publicMarketWsUrl}>{children}</MarketWSProvider>
  );
}
