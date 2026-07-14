import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import {
  connectLpSession,
  disconnectLpSession,
  toPublicSession,
} from "@/lib/lp/sdk";
import { getLpSession } from "@/lib/lp/session-store";

export async function GET() {
  const jar = await cookies();
  const id = jar.get(LP_SESSION_COOKIE)?.value;
  const record = id ? getLpSession(id) : undefined;
  return NextResponse.json(toPublicSession(record));
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

    const record = await connectLpSession({
      apiPrivateKey: body.apiPrivateKey ?? "",
      eoaPrivateKey: body.eoaPrivateKey ?? "",
    });

    const res = NextResponse.json(toPublicSession(record));
    res.cookies.set(LP_SESSION_COOKIE, record.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const jar = await cookies();
  const id = jar.get(LP_SESSION_COOKIE)?.value;
  if (id) {
    await disconnectLpSession(id);
  }
  const res = NextResponse.json(toPublicSession(undefined));
  res.cookies.set(LP_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
