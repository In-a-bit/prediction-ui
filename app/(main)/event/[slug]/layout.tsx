import { MarketWSProvider } from "@/components/providers/market-ws-provider";

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketWSProvider>{children}</MarketWSProvider>;
}
