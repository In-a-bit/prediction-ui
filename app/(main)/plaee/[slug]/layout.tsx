import { headers } from "next/headers";

import { MarketWSProvider } from "@/components/providers/market-ws-provider";

function marketProxyWsUrl(host: string, forwardedProto: string | null): string {
  const isHttps = forwardedProto === "https";
  const wsProto = isHttps ? "wss:" : "ws:";
  return `${wsProto}//${host}/api/ws-proxy/market`;
}

export default async function PlaeEventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:2030";
  const forwardedProto = h.get("x-forwarded-proto");
  const publicMarketWsUrl = marketProxyWsUrl(host, forwardedProto);

  return (
    <MarketWSProvider wsUrl={publicMarketWsUrl}>{children}</MarketWSProvider>
  );
}
