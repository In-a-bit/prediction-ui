"use client";

import { createContext, useContext, useMemo } from "react";
import { PG, pgUrl } from "@/lib/prediction-go";

type BuildClobUrl = (
  endpoint: string,
  params: Record<string, string>
) => string;

interface DataSourceContextValue {
  buildClobUrl: BuildClobUrl;
}

const CLOB_BASE = PG.clob;

function defaultBuildClobUrl(
  endpoint: string,
  params: Record<string, string>
): string {
  const sp = new URLSearchParams(params);
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${pgUrl(CLOB_BASE, path)}?${sp}`;
}

const DataSourceContext = createContext<DataSourceContextValue>({
  buildClobUrl: defaultBuildClobUrl,
});

export function DataSourceProvider({
  buildClobUrl,
  children,
}: {
  buildClobUrl: BuildClobUrl;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ buildClobUrl }), [buildClobUrl]);
  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource() {
  return useContext(DataSourceContext);
}
