import { MarketWSProvider } from "@/components/providers/market-ws-provider";
import { predictionGoMarketWsUrl } from "@/lib/prediction-go";

export default function PlaeEventLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicMarketWsUrl = predictionGoMarketWsUrl();

  return (
    <MarketWSProvider wsUrl={publicMarketWsUrl}>{children}</MarketWSProvider>
  );
}
