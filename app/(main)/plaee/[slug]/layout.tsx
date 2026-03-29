import { MarketWSProvider } from "@/components/providers/market-ws-provider";

const publicMarketWsUrl =
  process.env.NEXT_PUBLIC_PUBLIC_WS_URL?.trim() || undefined;

export default function PlaeEventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MarketWSProvider wsUrl={publicMarketWsUrl}>{children}</MarketWSProvider>
  );
}
