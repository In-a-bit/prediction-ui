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

      {/* Tab Switcher */}
      <div className="mb-6 flex rounded-xl bg-card-border/30 p-1">
        <Link
          href="/"
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition-colors",
            isCasinoActive
              ? "bg-brand text-white"
              : "text-muted hover:text-foreground"
          )}
        >
          Casino
        </Link>
        <Link
          href="/predictions"
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition-colors",
            isPredictionsActive
              ? "bg-brand text-white"
              : "text-muted hover:text-foreground"
          )}
        >
          Predictions
        </Link>
      </div>

      {/* Context-dependent navigation */}
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
                    : "text-muted hover:bg-card-hover hover:text-foreground"
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
