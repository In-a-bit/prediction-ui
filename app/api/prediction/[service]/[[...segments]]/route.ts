import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { PredictionProxyService } from "@/lib/prediction-proxy";

const SERVICES = new Set<PredictionProxyService>([
  "gamma",
  "clob",
  "relayer",
  "dpm",
  "data",
]);

function upstreamBase(service: PredictionProxyService): string | undefined {
  const trim = (s: string) => s.replace(/\/$/, "");
  switch (service) {
    case "gamma":
      return trim(
        process.env.GAMMA_API_URL ??
          process.env.NEXT_PUBLIC_GAMMA_API_URL ??
          "http://localhost:8084",
      );
    case "clob":
      return trim(
        process.env.CLOB_API_URL ??
          process.env.NEXT_PUBLIC_CLOB_API_URL ??
          "http://localhost:8083",
      );
    case "relayer":
      return trim(
        process.env.RELAYER_API_URL ??
          process.env.NEXT_PUBLIC_RELAYER_API_URL ??
          "http://localhost:8085",
      );
    case "dpm":
      return trim(
        process.env.DPM_API_URL ??
          process.env.NEXT_PUBLIC_DPM_API_URL ??
          "http://localhost:8086",
      );
    case "data":
      return trim(
        process.env.DATA_API_URL ??
          process.env.NEXT_PUBLIC_DATA_API_URL ??
          "http://localhost:8091",
      );
    default:
      return undefined;
  }
}

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
  service: PredictionProxyService,
  segments: string[] | undefined,
): Promise<Response> {
  const apiKey = process.env.APP_API_KEY?.trim();
  if (!apiKey) {
    console.error("[prediction-proxy] proxyRequest: APP_API_KEY is not set");
    return NextResponse.json(
      { error: "Server misconfigured: APP_API_KEY required" },
      { status: 500 },
    );
  }

  const base = upstreamBase(service);
  if (!base) {
    return NextResponse.json({ error: "Unknown service" }, { status: 404 });
  }

  const pathPart =
    segments && segments.length > 0 ? `/${segments.join("/")}` : "";
  const targetUrl = `${base}${pathPart}${req.nextUrl.search}`;

  const method = req.method.toUpperCase();
  const forwardHeaders = new Headers();
  forwardHeaders.set("X-API-Key", apiKey);

  req.headers.forEach((value, key) => {
    if (hopByHop(key) || key.toLowerCase() === "x-api-key") return;
    forwardHeaders.set(key, value);
  });

  // Gamma (and others) use this for Set-Cookie Secure. Must reflect the browser→Next scheme,
  // not a TLS hop Next→upstream or a stale forwarded header from the client.
  const clientProto = req.nextUrl.protocol === "https:" ? "https" : "http";
  forwardHeaders.set("X-Forwarded-Proto", clientProto);

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const buf = await req.arrayBuffer();
    body = buf.byteLength > 0 ? buf : undefined;
  }

  console.log("[prediction-proxy] proxyRequest", {
    service,
    method,
    targetUrl,
  });

  return fetch(targetUrl, {
    method,
    headers: forwardHeaders,
    body,
    redirect: "manual",
  });
}

type RouteCtx = {
  params: Promise<{ service: string; segments?: string[] }>;
};

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { service: raw, segments } = await ctx.params;
  if (!SERVICES.has(raw as PredictionProxyService)) {
    return NextResponse.json({ error: "Invalid service" }, { status: 404 });
  }
  const service = raw as PredictionProxyService;
  try {
    const res = await proxyRequest(req, service, segments);
    const outHeaders = new Headers(res.headers);
    outHeaders.delete("transfer-encoding");
    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: outHeaders,
    });
  } catch (err) {
    console.error("[prediction-proxy] handle: upstream error", { service, err });
    return NextResponse.json(
      { error: "Upstream request failed" },
      { status: 502 },
    );
  }
}
