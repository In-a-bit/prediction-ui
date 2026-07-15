import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import {
  connectLpSession,
  disconnectLpSession,
  publicFromSealed,
  toPublicSession,
  unsealLpSession,
} from "@/lib/lp/sdk";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  /** 7 days — demo keys live in the sealed cookie, not server memory. */
  maxAge: 60 * 60 * 24 * 7,
};

export async function GET() {
  const jar = await cookies();
  const token = jar.get(LP_SESSION_COOKIE)?.value;
  return NextResponse.json(
    publicFromSealed(token ? unsealLpSession(token) : null),
  );
}

export async function POST(req: Request) {
  let body: { apiPrivateKey?: string; eoaPrivateKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const jar = await cookies();
    const previous = jar.get(LP_SESSION_COOKIE)?.value;
    if (previous) {
      await disconnectLpSession(previous);
    }

    const { record, sealed } = await connectLpSession({
      apiPrivateKey: body.apiPrivateKey ?? "",
      eoaPrivateKey: body.eoaPrivateKey ?? "",
    });

    const res = NextResponse.json(toPublicSession(record));
    res.cookies.set(LP_SESSION_COOKIE, sealed, COOKIE_OPTS);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const jar = await cookies();
  const token = jar.get(LP_SESSION_COOKIE)?.value;
  if (token) {
    await disconnectLpSession(token);
  }
  const res = NextResponse.json(publicFromSealed(null));
  res.cookies.set(LP_SESSION_COOKIE, "", {
    ...COOKIE_OPTS,
    maxAge: 0,
  });
  return res;
}
