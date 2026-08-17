import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAddress } from "viem";

import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import { requireLpSession } from "@/lib/lp/sdk";

export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const record = await requireLpSession(jar.get(LP_SESSION_COOKIE)?.value);
    const body = await req.json();
    const conditionId = body?.conditionId;
    if (typeof conditionId !== "string" || !conditionId) {
      return NextResponse.json({ error: "conditionId is required" }, { status: 400 });
    }
    const recipient = body?.recipient;
    if (recipient !== undefined && (typeof recipient !== "string" || !isAddress(recipient))) {
      return NextResponse.json({ error: "recipient must be an address" }, { status: 400 });
    }
    const result = await record.sdk.submitRedeemPositions(conditionId, recipient);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("required") || message.includes("expired") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
