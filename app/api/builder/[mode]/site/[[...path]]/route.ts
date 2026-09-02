import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { builderBackendUrl, isBuilderMode, readSessionToken } from "@/lib/builder/config";
import { proxyToBuilder } from "@/lib/builder/proxy";

/**
 * Everything the builder's site asks of its own backend, on the signed-in customer's behalf.
 *
 * A proxy rather than a direct browser call for one reason: the customer's session token is sealed
 * in an httpOnly cookie, and attaching it here is what keeps it out of reach of page scripts. That
 * token can mint a Plaee sign-in link, so it is not something to hand the page.
 */
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ mode: string; path?: string[] }> },
): Promise<Response> {
  const { mode, path: segments } = await ctx.params;
  if (!isBuilderMode(mode)) {
    return NextResponse.json({ error: "Unknown builder" }, { status: 404 });
  }

  const path = segments && segments.length > 0 ? `/${segments.join("/")}` : "";
  // The sign-in routes answer with a bearer token, and this proxy hands its response straight to
  // the page. They go through /auth instead, which seals the token into a cookie.
  if (path === "/signup" || path === "/login" || path === "/logout") {
    return NextResponse.json({ error: "Use /api/builder/[mode]/auth" }, { status: 404 });
  }

  const token = await readSessionToken(mode);
  return proxyToBuilder(req, {
    mode,
    baseUrl: builderBackendUrl(mode),
    path: `/v1/site${path}`,
    auth: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export const GET = handle;
export const POST = handle;
