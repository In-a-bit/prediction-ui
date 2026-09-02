import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { BuilderMode } from "./types";

/**
 * Headers that must not be forwarded in either direction.
 *
 * `content-encoding` is the one that bites: undici decompresses the body while leaving the header
 * set, so passing it on makes the browser fail with ERR_CONTENT_DECODING_FAILED on a response that
 * is already plain text. `cookie` is excluded because the builder's backend authenticates with a
 * bearer token — forwarding this app's cookies would be handing them to another service.
 */
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
    n === "content-length" ||
    n === "content-encoding" ||
    n === "cookie"
  );
}

/**
 * Forwards a request to a builder's backend with a credential the page never sees.
 *
 * The credential is the whole reason this hop exists. A customer's session token can mint a Plaee
 * sign-in link and the operator's admin key can move anyone's balance; neither belongs anywhere a
 * script on the page could read it.
 */
export async function proxyToBuilder(
  req: NextRequest,
  options: { mode: BuilderMode; baseUrl: string; path: string; auth: Record<string, string> },
): Promise<Response> {
  const url = new URL(`${options.baseUrl}${options.path}`);
  url.search = req.nextUrl.search;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!hopByHop(key)) headers.set(key, value);
  });
  headers.delete("accept-encoding");
  for (const [key, value] of Object.entries(options.auth)) headers.set(key, value);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      ...(body === undefined || body.byteLength === 0 ? {} : { body }),
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      { error: `The ${options.mode} builder's backend is not reachable` },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!hopByHop(key)) responseHeaders.set(key, value);
  });
  // Nothing here is cacheable: a balance and a sign-in token are both per-request truths.
  responseHeaders.set("Cache-Control", "no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
