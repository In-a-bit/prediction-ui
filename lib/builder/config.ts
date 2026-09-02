import { cookies } from "next/headers";

import { sealJson, unsealJson } from "@/lib/seal";
import type { BuilderMode } from "./types";

/**
 * Where each builder's backend lives.
 *
 * Server-side environment, not a form: the demo has exactly two builders and the whole point is
 * to compare them, so choosing one is picking a side rather than configuring an integration.
 * Neither URL is a secret; the Plaee credential lives in the builder's backend, which is where a
 * real builder would keep it — this app never sees it.
 */
export function builderBackendUrl(mode: BuilderMode): string {
  const configured =
    mode === "segregated"
      ? process.env.BUILDER_SEGREGATED_URL
      : process.env.BUILDER_SHARED_URL;
  return (configured ?? (mode === "segregated" ? "http://localhost:3200" : "http://localhost:3201"))
    .replace(/\/+$/, "");
}

/**
 * The operator's admin credential, for the back office.
 *
 * Server-side only, and deliberately separate from everything the customer-facing pages use: this
 * key can credit or debit any customer and move the builder's treasury. Absent is a valid state —
 * the back office then says so rather than half-working.
 */
export function builderAdminKey(mode: BuilderMode): string | undefined {
  const key =
    mode === "segregated"
      ? process.env.BUILDER_SEGREGATED_ADMIN_KEY
      : process.env.BUILDER_SHARED_ADMIN_KEY;
  return key?.trim() || undefined;
}

export function isBuilderMode(value: string): value is BuilderMode {
  return value === "segregated" || value === "shared";
}

/**
 * One session cookie per builder, so signing into one does not appear to sign you into the other.
 *
 * Cookies ignore ports, so everything on localhost shares a jar — a single name would have the two
 * demo builders silently overwriting each other's sessions.
 */
export function sessionCookieName(mode: BuilderMode): string {
  return `builder_${mode}_session`;
}

const SCOPE = "builder-site";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24,
};

type Sealed = { v: 1; token: string; mode: BuilderMode };

export function sealSession(mode: BuilderMode, token: string): string {
  return sealJson(SCOPE, { v: 1, token, mode } satisfies Sealed);
}

/**
 * The customer's bearer token for their builder's backend.
 *
 * Sealed into an httpOnly cookie rather than handed to the page: it authorises minting a Plaee
 * sign-in token, and a token in reach of page scripts is a token any script on the page can use.
 */
export async function readSessionToken(mode: BuilderMode): Promise<string | null> {
  const jar = await cookies();
  const sealed = unsealJson<Sealed>(SCOPE, jar.get(sessionCookieName(mode))?.value);
  return sealed?.mode === mode ? sealed.token : null;
}
