# Plaee Tab + Casino Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "Plaee" sidebar tab with paginated events from inabit gamma-api (localhost:8084), event detail pages with market trading via inabit clob-api, and redesign the casino page with attractive visuals and real game imagery.

**Architecture:** The Plaee section mirrors the Predictions flow but targets the local gamma-api (`NEXT_PUBLIC_GAMMA_API_URL`) instead of Polymarket's public API. The events listing page (`/plae`) fetches paginated events, and each event detail page (`/plae/[slug]`) shows markets with the existing TradePanel wired to the local CLOB. The casino page gets a visual overhaul with hero section, real game images via Unsplash/placeholder, and premium card design.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, React Query, existing gamma-api/clob-api utils

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/(main)/plae/page.tsx` | Plaee events listing page with pagination |
| Create | `app/(main)/plae/[slug]/page.tsx` | Plaee event detail page (markets + trading) |
| Create | `components/plae/plae-event-grid.tsx` | Client-side paginated events grid |
| Create | `components/plae/plae-event-card.tsx` | Event card linking to `/plae/[slug]` |
| Create | `lib/api/plae-gamma.ts` | Fetch functions targeting local gamma-api |
| Create | `lib/hooks/use-plae-events.ts` | React Query hook for paginated plae events |
| Modify | `components/layout/sidebar.tsx` | Add third "Plaee" tab + plae-specific nav |
| Modify | `app/(main)/page.tsx` | Casino page redesign with hero + premium cards |
| Modify | `components/casino/game-card.tsx` | Premium card with real images, glow effects |
| Modify | `components/casino/game-grid.tsx` | Category filtering, featured section |
| Modify | `lib/data/casino-games.ts` | Add image URLs, featured flag, accent colors |
| Delete | `app/(main)/plae-event/[slug]/page.tsx` | Remove old test page (replaced by `/plae/[slug]`) |

---

### Task 1: Plaee Gamma API Client

**Files:**
- Create: `lib/api/plae-gamma.ts`

- [ ] **Step 1: Create plae-gamma.ts**

This module wraps fetch calls to the local gamma-api (`NEXT_PUBLIC_GAMMA_API_URL`). It mirrors `lib/api/gamma.ts` but targets the local backend and supports offset-based pagination.

```typescript
// lib/api/plae-gamma.ts
import type { GammaEvent } from "@/lib/types/event";

const PLAE_GAMMA_BASE =
  process.env.NEXT_PUBLIC_GAMMA_API_URL ?? "http://localhost:8084";

interface FetchPlaeeEventsParams {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
}

export interface PlaeeEventsResponse {
  events: GammaEvent[];
  hasMore: boolean;
}

export async function fetchPlaeeEvents(
  params: FetchPlaeeEventsParams = {},
): Promise<PlaeeEventsResponse> {
  const limit = params.limit ?? 12;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });
  // Request one extra to detect if there's a next page
  searchParams.set("limit", String(limit + 1));

  try {
    const res = await fetch(`${PLAE_GAMMA_BASE}/events?${searchParams}`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { events: [], hasMore: false };
    const data: GammaEvent[] = await res.json();
    const hasMore = data.length > limit;
    return { events: data.slice(0, limit), hasMore };
  } catch {
    return { events: [], hasMore: false };
  }
}

export async function fetchPlaeeEventBySlug(
  slug: string,
): Promise<GammaEvent | null> {
  try {
    const res = await fetch(`${PLAE_GAMMA_BASE}/events/slug/${slug}`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/api/plae-gamma.ts
git commit -m "feat: add plae gamma API client for local backend"
```

---

### Task 2: Plaee Events React Query Hook

**Files:**
- Create: `lib/hooks/use-plae-events.ts`

- [ ] **Step 1: Create the hook**

```typescript
// lib/hooks/use-plae-events.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { GammaEvent } from "@/lib/types/event";

const PLAE_GAMMA_BASE =
  process.env.NEXT_PUBLIC_GAMMA_API_URL ?? "http://localhost:8084";

interface UsePlaeeEventsParams {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
}

interface PlaeeEventsResult {
  events: GammaEvent[];
  hasMore: boolean;
}

async function getPlaeeEvents(
  params: UsePlaeeEventsParams,
): Promise<PlaeeEventsResult> {
  const limit = params.limit ?? 12;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });
  searchParams.set("limit", String(limit + 1));

  const res = await fetch(`${PLAE_GAMMA_BASE}/events?${searchParams}`);
  if (!res.ok) return { events: [], hasMore: false };
  const data: GammaEvent[] = await res.json();
  const hasMore = data.length > limit;
  return { events: data.slice(0, limit), hasMore };
}

export function usePlaeeEvents(params: UsePlaeeEventsParams) {
  return useQuery({
    queryKey: ["plae-events", params],
    queryFn: () => getPlaeeEvents(params),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hooks/use-plae-events.ts
git commit -m "feat: add usePlaeeEvents React Query hook"
```

---

### Task 3: Plaee Event Card Component

**Files:**
- Create: `components/plae/plae-event-card.tsx`

- [ ] **Step 1: Create the card component**

Reuses the same visual style as `EventCard` but links to `/plae/[slug]` and shows market count prominently.

```typescript
// components/plae/plae-event-card.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import type { GammaEvent } from "@/lib/types/event";
import { formatCompactNumber } from "@/lib/utils";

function parseOutcomePrices(event: GammaEvent): { yes: number; no: number } {
  const market = event.markets?.find((m) => {
    if (m.closed || !m.active) return false;
    if (m.outcomePrices) {
      try {
        const prices = JSON.parse(m.outcomePrices) as string[];
        if (prices.some((p) => parseFloat(p) >= 0.99 || parseFloat(p) <= 0.01))
          return false;
      } catch {}
    }
    return true;
  }) ?? event.markets?.[0];

  if (!market?.outcomePrices) return { yes: 0.5, no: 0.5 };
  try {
    const prices = JSON.parse(market.outcomePrices);
    return {
      yes: parseFloat(prices[0]) || 0.5,
      no: parseFloat(prices[1]) || 0.5,
    };
  } catch {
    return { yes: 0.5, no: 0.5 };
  }
}

export function PlaeeEventCard({ event }: { event: GammaEvent }) {
  const prices = parseOutcomePrices(event);
  const yesPercent = Math.round(prices.yes * 100);
  const noPercent = Math.round(prices.no * 100);

  return (
    <Link
      href={`/plae/${event.slug}`}
      className="group flex flex-col rounded-2xl border border-card-border bg-card transition-all hover:border-brand/30 hover:bg-card-hover"
    >
      {event.image && (
        <div className="relative h-28 w-full overflow-hidden rounded-t-2xl">
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {event.title}
        </h3>

        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-md bg-card-border/50 px-2 py-0.5 text-[11px] font-medium text-muted">
            Vol. {formatCompactNumber(event.volume || 0)}
          </span>
          {event.markets?.length > 1 && (
            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              {event.markets.length} markets
            </span>
          )}
        </div>

        <div className="mt-auto" />

        <div className="flex gap-2">
          <div className="flex flex-1 items-center justify-between rounded-xl bg-green-dim px-3 py-2">
            <span className="text-xs font-medium text-green">Yes</span>
            <span className="text-sm font-bold text-green">{yesPercent}¢</span>
          </div>
          <div className="flex flex-1 items-center justify-between rounded-xl bg-red-dim px-3 py-2">
            <span className="text-xs font-medium text-red">No</span>
            <span className="text-sm font-bold text-red">{noPercent}¢</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/plae/plae-event-card.tsx
git commit -m "feat: add PlaeeEventCard component"
```

---

### Task 4: Plaee Paginated Events Grid

**Files:**
- Create: `components/plae/plae-event-grid.tsx`

- [ ] **Step 1: Create the paginated grid**

This component manages page state, fetches via `usePlaeeEvents`, and shows Previous/Next pagination controls.

```typescript
// components/plae/plae-event-grid.tsx
"use client";

import { useState } from "react";
import { usePlaeeEvents } from "@/lib/hooks/use-plae-events";
import { PlaeeEventCard } from "./plae-event-card";
import type { GammaEvent } from "@/lib/types/event";

const PAGE_SIZE = 12;

export function PlaeeEventGrid({
  initialEvents,
  initialHasMore,
}: {
  initialEvents: GammaEvent[];
  initialHasMore: boolean;
}) {
  const [page, setPage] = useState(0);

  const { data, isLoading } = usePlaeeEvents({
    active: true,
    closed: false,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    order: "volume24hr",
    ascending: false,
  });

  const events = page === 0 && !data ? initialEvents : (data?.events ?? []);
  const hasMore = page === 0 && !data ? initialHasMore : (data?.hasMore ?? false);

  if (!events.length && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-16">
        <p className="text-sm text-muted">No events found</p>
      </div>
    );
  }

  return (
    <div>
      {isLoading && page > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-card-border bg-card"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((event) => (
            <PlaeeEventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-muted">Page {page + 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore}
          className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/plae/plae-event-grid.tsx
git commit -m "feat: add PlaeeEventGrid with pagination"
```

---

### Task 5: Plaee Events Listing Page

**Files:**
- Create: `app/(main)/plae/page.tsx`

- [ ] **Step 1: Create the page**

Server-side fetches the first page of events, passes to the client grid for pagination.

```typescript
// app/(main)/plae/page.tsx
import { Suspense } from "react";
import { PlaeeEventGrid } from "@/components/plae/plae-event-grid";
import { fetchPlaeeEvents } from "@/lib/api/plae-gamma";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plaee | DPM",
};

export default async function PlaeePage() {
  const { events, hasMore } = await fetchPlaeeEvents({
    active: true,
    closed: false,
    limit: 12,
    offset: 0,
    order: "volume24hr",
    ascending: false,
  });

  return (
    <>
      <section className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Plaee</h1>
        <p className="text-sm text-muted">
          Prediction markets powered by inabit — trade on real-world events.
        </p>
      </section>

      <section>
        <Suspense>
          <PlaeeEventGrid initialEvents={events} initialHasMore={hasMore} />
        </Suspense>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(main\)/plae/page.tsx
git commit -m "feat: add Plaee events listing page with pagination"
```

---

### Task 6: Plaee Event Detail Page

**Files:**
- Create: `app/(main)/plae/[slug]/page.tsx`
- Delete: `app/(main)/plae-event/[slug]/page.tsx`

- [ ] **Step 1: Create the plae event detail page**

This reuses existing `TradePanel`, `PriceChart`, `OrderBookView`, and `TradeTicker` components but fetches from the local gamma-api.

```typescript
// app/(main)/plae/[slug]/page.tsx
import { fetchPlaeeEventBySlug } from "@/lib/api/plae-gamma";
import { PriceChart } from "@/components/market/price-chart";
import { OrderBookView } from "@/components/market/order-book";
import { TradePanel } from "@/components/market/trade-panel";
import { TradeTicker } from "@/components/market/trade-ticker";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

interface PlaeeEventPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PlaeeEventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchPlaeeEventBySlug(slug);
  return {
    title: event ? `${event.title} | Plaee | DPM` : "Market | DPM",
  };
}

export default async function PlaeeEventPage({ params }: PlaeeEventPageProps) {
  const { slug } = await params;
  const event = await fetchPlaeeEventBySlug(slug);

  if (!event) notFound();

  // Find first active, non-closed, non-resolved market
  const market =
    event.markets.find((m) => {
      if (m.closed || !m.active) return false;
      if (m.outcomePrices) {
        try {
          const prices = JSON.parse(m.outcomePrices) as string[];
          if (
            prices.some(
              (p) => parseFloat(p) >= 0.99 || parseFloat(p) <= 0.01,
            )
          )
            return false;
        } catch {}
      }
      return true;
    }) ?? event.markets[0];

  const tokenIds = market?.clobTokenIds
    ? JSON.parse(market.clobTokenIds)
    : [];
  const yesTokenId = tokenIds[0] as string | undefined;
  const noTokenId = tokenIds[1] as string | undefined;

  let yesPrice = 50;
  let noPrice = 50;
  if (market?.outcomePrices) {
    try {
      const prices = JSON.parse(market.outcomePrices);
      yesPrice = Math.round(parseFloat(prices[0]) * 100);
      noPrice = Math.round(parseFloat(prices[1]) * 100);
    } catch {}
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link href="/plae" className="transition-colors hover:text-foreground">
          Plaee
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{event.title}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Event header */}
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <div className="mb-4 flex items-start gap-4">
              {event.image && (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={event.image}
                    alt={event.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-foreground lg:text-2xl">
                  {event.title}
                </h1>
                {event.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted">
                    {event.description}
                  </p>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap items-center gap-4 border-t border-card-border pt-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green">
                  {yesPrice}¢
                </span>
                <span className="text-sm text-muted">Yes</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-red">
                  {noPrice}¢
                </span>
                <span className="text-sm text-muted">No</span>
              </div>
              {event.markets?.length > 1 && (
                <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  {event.markets.length} markets
                </span>
              )}
              <div className="ml-auto text-sm text-muted">
                Vol. ${((event.volume || 0) / 1e6).toFixed(1)}M
              </div>
            </div>
          </div>

          {/* All markets list (if multi-market event) */}
          {event.markets?.length > 1 && (
            <div className="rounded-2xl border border-card-border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold text-muted">
                Markets
              </h2>
              <div className="space-y-3">
                {event.markets.map((m) => {
                  let mYes = 50;
                  let mNo = 50;
                  if (m.outcomePrices) {
                    try {
                      const p = JSON.parse(m.outcomePrices);
                      mYes = Math.round(parseFloat(p[0]) * 100);
                      mNo = Math.round(parseFloat(p[1]) * 100);
                    } catch {}
                  }
                  const isSelected = m.id === market?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                        isSelected
                          ? "border-brand/40 bg-brand/5"
                          : "border-card-border"
                      }`}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {m.question}
                      </span>
                      <div className="flex gap-3">
                        <span className="text-sm font-bold text-green">
                          {mYes}¢
                        </span>
                        <span className="text-sm font-bold text-red">
                          {mNo}¢
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Chart */}
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-muted">
              Price History
            </h2>
            <PriceChart tokenId={yesTokenId} />
          </div>

          {/* Order Book */}
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-muted">
              Order Book
            </h2>
            <OrderBookView tokenId={yesTokenId} />
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-muted">
              Recent Activity
            </h2>
            <TradeTicker
              conditionId={market?.conditionId}
              tokenIds={tokenIds.length > 0 ? tokenIds : undefined}
            />
          </div>
        </div>

        {/* Right column: Trade panel */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <TradePanel
            yesTokenId={yesTokenId}
            noTokenId={noTokenId}
            initialYesPrice={yesPrice}
            initialNoPrice={noPrice}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete old plae-event page**

```bash
rm -rf app/\(main\)/plae-event
```

- [ ] **Step 3: Commit**

```bash
git add app/\(main\)/plae/ && git add -u
git commit -m "feat: add Plaee event detail page, remove old plae-event"
```

---

### Task 7: Update Sidebar with Plaee Tab

**Files:**
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Add Plaee tab and detection logic**

Update the sidebar to have a 3-tab switcher (Casino | Predictions | Plaee) and detect plae-related routes.

The full updated `sidebar.tsx`:

```typescript
// components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const categories = [
  { label: "All", slug: "", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "New", slug: "new", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
  { label: "Politics", slug: "politics", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { label: "Crypto", slug: "crypto", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { label: "Sports", slug: "sports", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" },
  { label: "Culture", slug: "culture", icon: "M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-3 8h.01M12 12h.01M9 12h.01M6 20h12a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { label: "Science", slug: "science", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTag = searchParams.get("tag");

  const isCasinoActive =
    pathname === "/" || pathname.startsWith("/games/");
  const isPredictionsActive =
    pathname === "/predictions" ||
    pathname.startsWith("/event/") ||
    pathname === "/portfolio";
  const isPlaeeActive =
    pathname === "/plae" || pathname.startsWith("/plae/");

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-card-border bg-sidebar p-4 lg:block">
      {/* Logo */}
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
            <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
          </svg>
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground">
          DPM
        </span>
      </Link>

      {/* 3-Tab Switcher */}
      <div className="mb-6 flex rounded-xl bg-card-border/30 p-1">
        <Link
          href="/"
          className={cn(
            "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold transition-colors",
            isCasinoActive
              ? "bg-brand text-white"
              : "text-muted hover:text-foreground",
          )}
        >
          Casino
        </Link>
        <Link
          href="/predictions"
          className={cn(
            "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold transition-colors",
            isPredictionsActive
              ? "bg-brand text-white"
              : "text-muted hover:text-foreground",
          )}
        >
          Predictions
        </Link>
        <Link
          href="/plae"
          className={cn(
            "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold transition-colors",
            isPlaeeActive
              ? "bg-brand text-white"
              : "text-muted hover:text-foreground",
          )}
        >
          Plaee
        </Link>
      </div>

      {/* Category nav for Predictions tab */}
      {isPredictionsActive && (
        <nav className="space-y-1">
          {categories.map((cat) => {
            const href = cat.slug
              ? `/predictions?tag=${cat.slug}`
              : "/predictions";
            const isActive =
              cat.slug === ""
                ? pathname === "/predictions" && !currentTag
                : currentTag === cat.slug;

            return (
              <Link
                key={cat.slug}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-muted hover:bg-card-hover hover:text-foreground",
                )}
              >
                <svg
                  className="h-4.5 w-4.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={cat.icon} />
                </svg>
                {cat.label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Bottom section */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="rounded-xl border border-card-border bg-card p-3">
          <p className="text-xs font-medium text-muted">
            Casino games & prediction markets
          </p>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat: add Plaee tab to sidebar navigation"
```

---

### Task 8: Casino Page Redesign — Data Update

**Files:**
- Modify: `lib/data/casino-games.ts`

- [ ] **Step 1: Update casino games data with images and accent colors**

Add `image` URL (Unsplash), `accent` color for glow effects, and `featured` flag.

```typescript
// lib/data/casino-games.ts
export interface CasinoGame {
  id: string;
  title: string;
  description: string;
  href: string;
  comingSoon: boolean;
  category: string;
  gradient: string;
  icon: string;
  image: string;
  accent: string;
  featured: boolean;
}

export const casinoGames: CasinoGame[] = [
  {
    id: "blackjack",
    title: "Blackjack",
    description: "Beat the dealer to 21 without going bust",
    href: "/games/blackjack",
    comingSoon: true,
    category: "cards",
    gradient: "from-emerald-600 to-emerald-900",
    icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z",
    image: "https://images.unsplash.com/photo-1541278107931-e006523892df?w=600&h=400&fit=crop",
    accent: "emerald",
    featured: true,
  },
  {
    id: "roulette",
    title: "Roulette",
    description: "Spin the wheel and place your bets",
    href: "/games/roulette",
    comingSoon: true,
    category: "table",
    gradient: "from-red-600 to-red-900",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    image: "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&h=400&fit=crop",
    accent: "red",
    featured: true,
  },
  {
    id: "slots",
    title: "Slots",
    description: "Try your luck on the slot machines",
    href: "/games/slots",
    comingSoon: true,
    category: "machines",
    gradient: "from-yellow-500 to-orange-600",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    image: "https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=600&h=400&fit=crop",
    accent: "amber",
    featured: true,
  },
  {
    id: "poker",
    title: "Poker",
    description: "Texas Hold'em against other players",
    href: "/games/poker",
    comingSoon: true,
    category: "cards",
    gradient: "from-blue-600 to-blue-900",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z",
    image: "https://images.unsplash.com/photo-1609743522653-52354461eb27?w=600&h=400&fit=crop",
    accent: "blue",
    featured: true,
  },
  {
    id: "baccarat",
    title: "Baccarat",
    description: "Bet on the player, banker, or tie",
    href: "/games/baccarat",
    comingSoon: true,
    category: "cards",
    gradient: "from-purple-600 to-purple-900",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    image: "https://images.unsplash.com/photo-1517232115160-ff93364542dd?w=600&h=400&fit=crop",
    accent: "purple",
    featured: false,
  },
  {
    id: "craps",
    title: "Craps",
    description: "Roll the dice and beat the house",
    href: "/games/craps",
    comingSoon: true,
    category: "dice",
    gradient: "from-teal-500 to-teal-800",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    image: "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=600&h=400&fit=crop",
    accent: "teal",
    featured: false,
  },
  {
    id: "dice",
    title: "Dice",
    description: "Predict the roll and win big",
    href: "/games/dice",
    comingSoon: true,
    category: "dice",
    gradient: "from-pink-500 to-rose-700",
    icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    image: "https://images.unsplash.com/photo-1522069213448-443a614da9b6?w=600&h=400&fit=crop",
    accent: "pink",
    featured: false,
  },
  {
    id: "coin-flip",
    title: "Coin Flip",
    description: "Heads or tails — double or nothing",
    href: "/games/coin-flip",
    comingSoon: true,
    category: "instant",
    gradient: "from-amber-500 to-yellow-700",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    image: "https://images.unsplash.com/photo-1621944190310-e3cca1564bd7?w=600&h=400&fit=crop",
    accent: "yellow",
    featured: false,
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add lib/data/casino-games.ts
git commit -m "feat: add images, accent colors, and featured flag to casino games"
```

---

### Task 9: Casino Page Redesign — Game Card

**Files:**
- Modify: `components/casino/game-card.tsx`

- [ ] **Step 1: Redesign game card with real images and glow effects**

Replace the full `game-card.tsx` with a premium design:

```typescript
// components/casino/game-card.tsx
import Link from "next/link";
import Image from "next/image";
import type { CasinoGame } from "@/lib/data/casino-games";

const accentMap: Record<string, { glow: string; badge: string; border: string }> = {
  emerald: { glow: "shadow-emerald-500/20", badge: "bg-emerald-500/10 text-emerald-400", border: "hover:border-emerald-500/40" },
  red:     { glow: "shadow-red-500/20",     badge: "bg-red-500/10 text-red-400",         border: "hover:border-red-500/40" },
  amber:   { glow: "shadow-amber-500/20",   badge: "bg-amber-500/10 text-amber-400",     border: "hover:border-amber-500/40" },
  blue:    { glow: "shadow-blue-500/20",     badge: "bg-blue-500/10 text-blue-400",       border: "hover:border-blue-500/40" },
  purple:  { glow: "shadow-purple-500/20",   badge: "bg-purple-500/10 text-purple-400",   border: "hover:border-purple-500/40" },
  teal:    { glow: "shadow-teal-500/20",     badge: "bg-teal-500/10 text-teal-400",       border: "hover:border-teal-500/40" },
  pink:    { glow: "shadow-pink-500/20",     badge: "bg-pink-500/10 text-pink-400",       border: "hover:border-pink-500/40" },
  yellow:  { glow: "shadow-yellow-500/20",   badge: "bg-yellow-500/10 text-yellow-400",   border: "hover:border-yellow-500/40" },
};

export function GameCard({ game }: { game: CasinoGame }) {
  const colors = accentMap[game.accent] ?? accentMap.blue;

  return (
    <Link
      href={game.href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-card-border bg-card transition-all duration-300 hover:bg-card-hover hover:shadow-xl ${colors.glow} ${colors.border}`}
    >
      {/* Image */}
      <div className="relative h-40 w-full overflow-hidden">
        <Image
          src={game.image}
          alt={game.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />

        {/* Category pill */}
        <div className="absolute left-3 top-3">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${colors.badge}`}>
            {game.category}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 text-base font-bold text-foreground">
          {game.title}
        </h3>
        <p className="mb-4 text-xs leading-relaxed text-muted">
          {game.description}
        </p>

        <div className="mt-auto" />

        {game.comingSoon ? (
          <div className="flex items-center justify-between">
            <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${colors.badge}`}>
              Coming Soon
            </span>
            <svg
              className="h-5 w-5 text-muted/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        ) : (
          <button className={`w-full rounded-xl py-2.5 text-sm font-bold text-white bg-gradient-to-r ${game.gradient} transition-shadow hover:shadow-lg ${colors.glow}`}>
            Play Now
          </button>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/casino/game-card.tsx
git commit -m "feat: redesign casino game card with images and glow effects"
```

---

### Task 10: Casino Page Redesign — Grid & Hero

**Files:**
- Modify: `components/casino/game-grid.tsx`
- Modify: `app/(main)/page.tsx`

- [ ] **Step 1: Update game grid with featured section**

```typescript
// components/casino/game-grid.tsx
import { casinoGames } from "@/lib/data/casino-games";
import { GameCard } from "./game-card";

export function GameGrid() {
  const featured = casinoGames.filter((g) => g.featured);
  const rest = casinoGames.filter((g) => !g.featured);

  return (
    <div className="space-y-8">
      {/* Featured games — larger cards */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
          <svg className="h-4 w-4 text-brand" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          Featured
        </h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {featured.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>

      {/* All other games */}
      {rest.length > 0 && (
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            More Games
          </h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rest.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update casino page with hero section**

```typescript
// app/(main)/page.tsx
import { GameGrid } from "@/components/casino/game-grid";

export default function CasinoPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative mb-10 overflow-hidden rounded-2xl border border-card-border bg-gradient-to-br from-brand/20 via-card to-purple-500/10 p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
              Live
            </span>
          </div>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-foreground">
            Casino
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Pick a game and test your luck. New games launching soon — play
            blackjack, roulette, poker, and more with your DPM balance.
          </p>
        </div>
      </section>

      {/* Games */}
      <section>
        <GameGrid />
      </section>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/casino/game-grid.tsx app/\(main\)/page.tsx
git commit -m "feat: redesign casino page with hero section and featured games"
```

---

### Task 11: Next.js Image Config for External Domains

**Files:**
- Modify: `next.config.ts` (or `next.config.js`/`next.config.mjs`)

- [ ] **Step 1: Check current config and add images.remotePatterns for Unsplash**

Find the Next.js config file and add Unsplash to the allowed image domains. The exact edit depends on the current file — add this to the config object:

```typescript
images: {
  remotePatterns: [
    // ... keep any existing patterns ...
    {
      protocol: "https",
      hostname: "images.unsplash.com",
    },
  ],
},
```

- [ ] **Step 2: Commit**

```bash
git add next.config.*
git commit -m "feat: allow Unsplash images in Next.js config"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Run `npm run build` (or `next build`) and fix any TypeScript/build errors**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Manually verify in browser**
- Navigate to `/` — casino hero + featured games + real images render
- Navigate to `/plae` — paginated events from local gamma-api
- Click an event — `/plae/[slug]` shows event detail with trade panel
- Sidebar shows 3 tabs, active states work correctly
- Pagination Previous/Next buttons work

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address build issues from plae tab and casino redesign"
```
