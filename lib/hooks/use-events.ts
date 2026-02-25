"use client";

import { useQuery } from "@tanstack/react-query";
import type { GammaEvent } from "@/lib/types/event";

async function getEvents(params: {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  tag?: string;
}): Promise<GammaEvent[]> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });

  const res = await fetch(`/api/events?${searchParams}`);
  if (!res.ok) return [];
  return res.json();
}

export function useEvents(params: {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  tag?: string;
}) {
  return useQuery({
    queryKey: ["events", params],
    queryFn: () => getEvents(params),
  });
}
