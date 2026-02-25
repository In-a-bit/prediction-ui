"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export function Header() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-40 mb-6 flex items-center gap-4 border-b border-card-border bg-header py-3 backdrop-blur-xl">
      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search markets"
          className="w-full rounded-xl border border-card-border bg-input py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none"
        />
      </div>

      {/* Auth */}
      <div className="flex items-center gap-3">
        {session?.user ? (
          <>
            <Link
              href="/portfolio"
              className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-hover"
            >
              Portfolio
            </Link>
            <div className="flex items-center gap-3 rounded-xl border border-card-border px-4 py-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {session.user.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="text-sm font-medium text-foreground">
                {session.user.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                Log out
              </button>
            </div>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-xl border border-card-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-card-hover"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
