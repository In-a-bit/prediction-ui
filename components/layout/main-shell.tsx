"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Header } from "@/components/layout/header";
import { LpDemoProviders } from "@/components/lp/lp-demo-providers";

function isLpPath(pathname: string) {
  return pathname === "/lp" || pathname.startsWith("/lp/");
}

/**
 * Wraps Header + page: LP routes get server-SDK providers; others stay as-is.
 *
 * The Builder tab needs no provider stack of its own — no market surface, no websockets, no
 * trading context. Everything it shows comes from `/api/builder/*`, and everything a user trades
 * happens inside the embedded iframe. It is listed here only so the intent is explicit rather
 * than an omission someone later "fixes".
 */
export function MainShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lp = isLpPath(pathname);

  if (lp) {
    return (
      <LpDemoProviders>
        <Header />
        {children}
      </LpDemoProviders>
    );
  }

  return (
    <>
      <Header />
      {children}
    </>
  );
}
