import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import { requireLpSession, toPublicSession } from "@/lib/lp/sdk";

/** Re-check allowance and submit CTF approval via SDK if needed. */
export async function POST() {
  try {
    const jar = await cookies();
    const record = requireLpSession(jar.get(LP_SESSION_COOKIE)?.value);
    const { checkAllowanceAndSignIfNeeded } = await import("@/lib/allowance");
    await checkAllowanceAndSignIfNeeded(record.sdk, record.session.user);
    // Refresh user profile from gamma for latest allowance_status.
    const restored = await record.sdk.auth.restore();
    if (restored) {
      record.session = restored;
    }
    return NextResponse.json(toPublicSession(record));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("required") || message.includes("expired") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
