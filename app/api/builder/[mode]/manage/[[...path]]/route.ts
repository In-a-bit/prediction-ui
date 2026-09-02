import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { builderAdminKey, builderBackendUrl, isBuilderMode } from "@/lib/builder/config";
import { proxyToBuilder } from "@/lib/builder/proxy";

/**
 * The builder's back office.
 *
 * Carries the operator's **admin** key, which can move any customer's balance and move USDC
 * between the builder's platform wallets. It is read from server-side environment and attached
 * here; it must never reach the browser, which is why there is no version of this page that talks
 * to the operator directly.
 *
 * This is staff tooling for a local demo and has no login of its own — anyone who can reach this
 * app can reach it. That is a deliberate simplification, not an oversight: the real protection is
 * that the key lives here rather than in the page, and the demo runs on localhost.
 */
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ mode: string; path?: string[] }> },
): Promise<Response> {
  const { mode, path: segments } = await ctx.params;
  if (!isBuilderMode(mode)) {
    return NextResponse.json({ error: "Unknown builder" }, { status: 404 });
  }

  const adminKey = builderAdminKey(mode);
  if (!adminKey) {
    return NextResponse.json(
      {
        error:
          `No admin key configured for the ${mode} builder. Set ` +
          `BUILDER_${mode.toUpperCase()}_ADMIN_KEY to its operator's admin credential.`,
      },
      { status: 503 },
    );
  }

  const path = segments && segments.length > 0 ? `/${segments.join("/")}` : "";
  return proxyToBuilder(req, {
    mode,
    baseUrl: builderBackendUrl(mode),
    path: `/v1/manage${path}`,
    auth: { "X-Api-Key": adminKey },
  });
}

export const GET = handle;
export const POST = handle;
