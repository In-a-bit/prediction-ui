import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_OPTIONS,
  builderBackendUrl,
  isBuilderMode,
  readSessionToken,
  sealSession,
  sessionCookieName,
} from "@/lib/builder/config";
import type { BuilderMode } from "@/lib/builder/types";

type Action = "signup" | "login" | "logout";

type SiteSession = {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; displayName: string | null; plaeeUserId: string | null };
};

/**
 * Signing in and out of a builder's own site.
 *
 * Separate from the generic `/site/*` proxy because this is the one exchange whose response must
 * not reach the page: the builder answers with a bearer token, and it gets sealed into an httpOnly
 * cookie here. The page is told who signed in, never with what.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ mode: string }> },
): Promise<Response> {
  const { mode } = await ctx.params;
  if (!isBuilderMode(mode)) {
    return NextResponse.json({ error: "Unknown builder" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as
    | { action?: Action; email?: string; password?: string; displayName?: string }
    | null;
  const action = body?.action;
  if (action !== "signup" && action !== "login" && action !== "logout") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (action === "logout") return logout(mode);

  const upstream = await call(mode, `/${action}`, {
    email: body?.email ?? "",
    password: body?.password ?? "",
    ...(action === "signup" && body?.displayName ? { displayName: body.displayName } : {}),
  });
  if ("error" in upstream) return upstream.error;

  const session = upstream.body as SiteSession;
  const response = NextResponse.json({ user: session.user }, { status: 200 });
  response.cookies.set(sessionCookieName(mode), sealSession(mode, session.accessToken), {
    ...SESSION_COOKIE_OPTIONS,
    expires: new Date(session.expiresAt),
  });
  return response;
}

/**
 * Drops the cookie first and tells the builder second.
 *
 * If the builder is unreachable the customer is still signed out here, which is the behaviour they
 * asked for; the orphaned token expires on its own.
 */
async function logout(mode: BuilderMode): Promise<Response> {
  const token = await readSessionToken(mode);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName(mode), "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  if (token) {
    await fetch(`${builderBackendUrl(mode)}/v1/site/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  return response;
}

async function call(
  mode: BuilderMode,
  path: string,
  payload: Record<string, string>,
): Promise<{ body: unknown } | { error: Response }> {
  let upstream: Response;
  try {
    upstream = await fetch(`${builderBackendUrl(mode)}/v1/site${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      error: NextResponse.json(
        { error: `The ${mode} builder's backend is not reachable` },
        { status: 502 },
      ),
    };
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    // Pass the builder's own wording through — "that email is taken" is its answer to give.
    return { error: new NextResponse(text, { status: upstream.status, headers: jsonHeaders() }) };
  }
  return { body: JSON.parse(text) as unknown };
}

function jsonHeaders(): Headers {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  return headers;
}
