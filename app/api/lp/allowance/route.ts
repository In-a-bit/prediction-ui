import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import {
  requireLpSession,
  resealLpSession,
  toPublicSession,
} from "@/lib/lp/sdk";

/** Re-check allowance and submit CTF approval via SDK if needed. */
export async function POST() {
  try {
    const jar = await cookies();
    const record = await requireLpSession(jar.get(LP_SESSION_COOKIE)?.value);
    const { checkAllowanceAndSignIfNeeded } = await import("@/lib/allowance");
    await checkAllowanceAndSignIfNeeded(record.sdk, record.session.user);
    // Refresh user profile from gamma for latest allowance_status.
    const restored = await record.sdk.auth.restore();
    if (restored) {
      record.session = restored;
    }
    const sealed = resealLpSession(record);
    const res = NextResponse.json(toPublicSession(record));
    res.cookies.set(LP_SESSION_COOKIE, sealed, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("required") || message.includes("expired") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
