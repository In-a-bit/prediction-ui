"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getPlaeSoccerTopics,
  plaeCryptoTopic,
  plaeSoccerGroup,
} from "@/lib/data/plae-topics";
import { cn } from "@/lib/utils";

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      className="h-4.5 w-4.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

function topicHref(slug: string) {
  return `/plaee/t/${slug}`;
}

function topicIsActive(pathname: string, slug: string) {
  return pathname === topicHref(slug);
}

export function PlaeSidebarNav() {
  const pathname = usePathname();
  const soccerTopics = getPlaeSoccerTopics();
  const soccerChildActive = soccerTopics.some((topic) =>
    topicIsActive(pathname, topic.slug),
  );
  const [soccerOpen, setSoccerOpen] = useState(soccerChildActive);

  useEffect(() => {
    if (soccerChildActive) {
      setSoccerOpen(true);
    }
  }, [soccerChildActive]);

  const cryptoActive = topicIsActive(pathname, plaeCryptoTopic.slug);

  return (
    <nav className="space-y-1">
      <Link
        href={topicHref(plaeCryptoTopic.slug)}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          cryptoActive
            ? "bg-brand/10 text-brand"
            : "text-muted hover:bg-card-hover hover:text-foreground",
        )}
      >
        <NavIcon path="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        {plaeCryptoTopic.label}
      </Link>

      <div>
        <button
          type="button"
          onClick={() => setSoccerOpen((open) => !open)}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            soccerChildActive
              ? "text-brand"
              : "text-muted hover:bg-card-hover hover:text-foreground",
          )}
        >
          <NavIcon path={plaeSoccerGroup.icon} />
          <span className="flex-1 text-left">{plaeSoccerGroup.label}</span>
          <svg
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              soccerOpen && "rotate-180",
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {soccerOpen ? (
          <div className="ml-3 mt-1 space-y-1 border-l border-card-border pl-3">
            {soccerTopics.map((topic) => {
              const isActive = topicIsActive(pathname, topic.slug);

              return (
                <Link
                  key={topic.slug}
                  href={topicHref(topic.slug)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand/10 text-brand"
                      : "text-muted hover:bg-card-hover hover:text-foreground",
                  )}
                >
                  <NavIcon path={plaeSoccerGroup.icon} />
                  {topic.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
