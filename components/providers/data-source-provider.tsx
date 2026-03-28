"use client";

import { createContext, useContext, useMemo } from "react";

type BuildClobUrl = (
  endpoint: string,
  params: Record<string, string>
) => string;

interface DataSourceContextValue {
  buildClobUrl: BuildClobUrl;
}

const CLOB_BASE =
  process.env.NEXT_PUBLIC_CLOB_API_URL ?? "http://localhost:8083";

function defaultBuildClobUrl(
  endpoint: string,
  params: Record<string, string>
): string {
  const sp = new URLSearchParams(params);
  return `${CLOB_BASE}/${endpoint}?${sp}`;
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
