import type { BuilderMode } from "./types";

/**
 * Whether the custody-builder demo exists in this deployment: its tab and its `/builder` routes.
 *
 * Off unless explicitly "true". The sidebar checks it for the tab and `proxy.ts` for the routes.
 * `NEXT_PUBLIC_BUILDER_*_URL` and `PLAEE_BASE_URL` are only read by the demo, so a deployment
 * without it does not configure them.
 *
 * Public because the sidebar is a client component; Next inlines it at build time, so changing it
 * takes a rebuild.
 */
export function isBuilderEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BUILDER_ENABLED?.trim() === "true";
}

/**
 * Where each builder's backend lives, as the browser reaches it.
 *
 * Public environment, not a form: the demo has exactly two builders and the whole point is to
 * compare them, so choosing one is picking a side rather than configuring an integration. The page
 * calls these directly, so the builder sees the customer's own IP rather than this app's server.
 * Neither URL is a secret; the Plaee credential lives in the builder's backend, which is where a
 * real builder would keep it — this app never sees it.
 *
 * Each variable is read by its full name because Next only inlines `NEXT_PUBLIC_*` on static access.
 */
export function builderBackendUrl(mode: BuilderMode): string {
  const configured =
    mode === "segregated"
      ? process.env.NEXT_PUBLIC_BUILDER_SEGREGATED_URL
      : process.env.NEXT_PUBLIC_BUILDER_SHARED_URL;
  return (configured || (mode === "segregated" ? "http://localhost:3200" : "http://localhost:3201"))
    .replace(/\/+$/, "");
}

export function isBuilderMode(value: string): value is BuilderMode {
  return value === "segregated" || value === "shared";
}
