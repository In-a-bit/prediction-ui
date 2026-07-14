"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Header } from "@/components/layout/header";
import { LpDemoProviders } from "@/components/lp/lp-demo-providers";

function isLpPath(pathname: string) {
  return pathname === "/lp" || pathname.startsWith("/lp/");
}

/** Wraps Header + page: LP routes get server-SDK providers; others stay as-is. */
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
