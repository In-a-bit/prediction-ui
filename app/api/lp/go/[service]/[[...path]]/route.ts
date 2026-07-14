import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  LP_ADDRESS_HEADER,
  LP_API_KEY_HEADER,
  lpUpstreamBase,
  type LpGoService,
} from "@/lib/lp/direct-urls";
import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import { requireLpSession } from "@/lib/lp/sdk";

const SERVICES = new Set<LpGoService>([
  "gamma",
  "clob",
  "relayer",
  "dpm",
  "data",
  "price",
]);

function hopByHop(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === "connection" ||
    n === "keep-alive" ||
    n === "proxy-authenticate" ||
    n === "proxy-authorization" ||
    n === "te" ||
    n === "trailers" ||
    n === "transfer-encoding" ||
    n === "upgrade" ||
    n === "host" ||
    n === "content-length"
  );
}

async function proxyRequest(
  req: NextRequest,
  service: LpGoService,
  segments: string[] | undefined,
): Promise<Response> {
  const jar = await cookies();
  let record;
  try {
    record = requireLpSession(jar.get(LP_SESSION_COOKIE)?.value);
  } catch {
    return NextResponse.json(
      { error: "Connect LP session first (X-LP-Api-Key required)" },
      { status: 401 },
    );
  }

  const base = lpUpstreamBase(service);
  const pathPart =
    segments && segments.length > 0 ? `/${segments.join("/")}` : "";
  const targetUrl = `${base}${pathPart}${req.nextUrl.search}`;

  const method = req.method.toUpperCase();
  const forwardHeaders = new Headers();
  forwardHeaders.set(LP_API_KEY_HEADER, record.apiPrivateKey);
  forwardHeaders.set(LP_ADDRESS_HEADER, record.session.eoaAddress);

  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      hopByHop(key) ||
      lower === "x-api-key" ||
      lower === "x-lp-api-key" ||
      lower === "x-lp-address"
    ) {
      return;
    }
    forwardHeaders.set(key, value);
  });

  const clientProto = req.nextUrl.protocol === "https:" ? "https" : "http";
  forwardHeaders.set("X-Forwarded-Proto", clientProto);

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const buf = await req.arrayBuffer();
    body = buf.byteLength > 0 ? buf : undefined;
  }

  const upstream = await fetch(targetUrl, {
    method,
    headers: forwardHeaders,
    body,
    // @ts-expect-error undici duplex for streaming bodies
    duplex: body ? "half" : undefined,
  });

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (hopByHop(key)) return;
    resHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

type RouteCtx = { params: Promise<{ service: string; path?: string[] }> };

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { service, path } = await ctx.params;
  if (!SERVICES.has(service as LpGoService)) {
    return NextResponse.json({ error: "Unknown service" }, { status: 404 });
  }
  return proxyRequest(req, service as LpGoService, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
