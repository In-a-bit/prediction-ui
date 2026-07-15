import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { lpWsUrlsWithLpAuth } from "@/lib/lp/direct-urls";
import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import { requireLpSession } from "@/lib/lp/sdk";

/**
 * Market/prices/user WS URLs for LP tab — credentials via lp_api_key + lp_address
 * query (browsers cannot set X-LP-* headers on WebSocket).
 */
export async function GET() {
  try {
    const jar = await cookies();
    const record = await requireLpSession(jar.get(LP_SESSION_COOKIE)?.value);
    return NextResponse.json(
      lpWsUrlsWithLpAuth(record.apiPrivateKey, record.session.eoaAddress),
    );
  } catch {
    return NextResponse.json(
      { error: "Connect LP session first" },
      { status: 401 },
    );
  }
}
