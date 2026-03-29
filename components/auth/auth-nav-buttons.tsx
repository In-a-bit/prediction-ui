"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useMagic } from "@/components/providers/magic-provider";
import { authNavOutlineClass, authNavPrimaryClass } from "./auth-nav-styles";

export { authNavOutlineClass, authNavPrimaryClass } from "./auth-nav-styles";

export function AuthNavLoginLink() {
  return (
    <Link href="/login" className={authNavOutlineClass}>
      Log in
    </Link>
  );
}

export function AuthNavSignupLink() {
  return (
    <Link href="/signup" className={authNavPrimaryClass}>
      Sign up
    </Link>
  );
}

/** Signed-in strip: avatar initial, display name, log out (same on every route). */
export function AuthNavSignedInBar() {
  const { data: session } = useSession();
  const { disconnect } = useMagic();
  const name = session?.user?.name ?? "";
  const initial = name.trim()[0]?.toUpperCase() ?? "U";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
        {initial}
      </div>
      <span className="max-w-[10rem] truncate text-sm font-medium text-foreground">
        {name || "Account"}
      </span>
      <button
        type="button"
        onClick={async () => {
          await disconnect();
          await signOut({ callbackUrl: "/login" });
        }}
        className="shrink-0 text-xs text-muted transition-colors hover:text-foreground"
      >
        Log out
      </button>
    </div>
  );
}
