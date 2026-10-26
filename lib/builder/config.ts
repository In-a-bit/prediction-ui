import type { BuilderMode } from "./types";

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
