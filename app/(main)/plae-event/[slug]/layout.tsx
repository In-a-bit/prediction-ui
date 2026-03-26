"use client";

import { useCallback } from "react";
import { DataSourceProvider } from "@/components/providers/data-source-provider";
import { MarketWSProvider } from "@/components/providers/market-ws-provider";

const CLOB_BASE = process.env.NEXT_PUBLIC_CLOB_API_URL!;
const WS_URL = process.env.NEXT_PUBLIC_CLOB_WS_URL!;

export default function PlaeEventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const buildClobUrl = useCallback(
    (endpoint: string, params: Record<string, string>) => {
      const sp = new URLSearchParams(params);
      return `${CLOB_BASE}/${endpoint}?${sp}`;
    },
    []
  );

  return (
    <DataSourceProvider buildClobUrl={buildClobUrl}>
      <MarketWSProvider wsUrl={WS_URL}>{children}</MarketWSProvider>
    </DataSourceProvider>
  );
}
