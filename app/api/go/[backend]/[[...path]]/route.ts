import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ORIGINS: Record<string, string> = {
  clob: "http://127.0.0.1:8083",
  gamma: "http://127.0.0.1:8084",
  dpm: "http://127.0.0.1:8086",
  data: "http://127.0.0.1:8091",
  relayer: "http://127.0.0.1:8085",
};

function backendOrigin(backend: string): string | undefined {
  const envMap: Record<string, string | undefined> = {
    clob: process.env.CLOB_API_ORIGIN,
    gamma: process.env.GAMMA_API_ORIGIN,
    dpm: process.env.DPM_API_ORIGIN,
    data: process.env.DATA_API_ORIGIN,
    relayer: process.env.RELAYER_API_ORIGIN,
  };
  return envMap[backend] ?? DEFAULT_ORIGINS[backend];
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

async function proxy(
  req: NextRequest,
  backend: string,
  pathSegments: string[] | undefined
): Promise<Response> {
  const origin = backendOrigin(backend);
  if (!origin) {
    return NextResponse.json({ error: `Unknown backend: ${backend}` }, { status: 404 });
  }
  const appKey = process.env.APP_API_KEY;
  if (!appKey) {
    return NextResponse.json(
      { error: "APP_API_KEY must be set on the Next.js server for prediction-go proxy" },
      { status: 503 }
    );
  }

  const pathPart = pathSegments?.filter(Boolean).join("/") ?? "";
  const pathname = pathPart ? `/${pathPart}` : "/";
  const base = origin.replace(/\/$/, "");
  const target = new URL(base + pathname);
  target.search = req.nextUrl.search;

  const outHeaders = new Headers();
  req.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (!HOP_BY_HOP.has(lk)) {
      outHeaders.set(key, value);
    }
  });
  outHeaders.set("X-API-Key", appKey);

  const method = req.method;
  const init: RequestInit = {
    method,
    headers: outHeaders,
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = req.body;
    (init as RequestInit & { duplex?: string }).duplex = "half";
  }

  const res = await fetch(target, init);
  const resHeaders = new Headers();
  res.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.has(k.toLowerCase())) {
      resHeaders.set(k, v);
    }
  });
  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
  });
}

type RouteCtx = { params: Promise<{ backend: string; path?: string[] }> };

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { backend, path } = await ctx.params;
  return proxy(req, backend, path);
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
