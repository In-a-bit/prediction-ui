"use client";

import { createContext, useContext, useMemo } from "react";

type BuildClobUrl = (
  endpoint: string,
  params: Record<string, string>
) => string;

interface DataSourceContextValue {
  buildClobUrl: BuildClobUrl;
}

function defaultBuildClobUrl(
  endpoint: string,
  params: Record<string, string>
): string {
  const sp = new URLSearchParams({ endpoint, ...params });
  return `/api/clob?${sp}`;
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
