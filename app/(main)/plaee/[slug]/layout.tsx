import { MarketSurfaceProvider } from "@/components/providers/market-surface-provider";
import { CryptoPricesWSProvider } from "@/components/providers/crypto-prices-ws-provider";
import { MarketWSProvider } from "@/components/providers/market-ws-provider";
import { predictionGoMarketWsUrl } from "@/lib/prediction-go";

export default function PlaeEventLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicMarketWsUrl = predictionGoMarketWsUrl();

  return (
    <MarketSurfaceProvider id="plaee" basePath="/plaee" label="Plaee">
      <MarketWSProvider wsUrl={publicMarketWsUrl}>
        <CryptoPricesWSProvider>{children}</CryptoPricesWSProvider>
      </MarketWSProvider>
    </MarketSurfaceProvider>
  );
}
