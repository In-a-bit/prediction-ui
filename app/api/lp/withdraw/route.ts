import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import { requireLpSession } from "@/lib/lp/sdk";

export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const record = await requireLpSession(jar.get(LP_SESSION_COOKIE)?.value);
    const body = await req.json();
    const recipient = body?.recipient;
    const amount = body?.amount;
    if (typeof recipient !== "string" || !recipient) {
      return NextResponse.json({ error: "recipient is required" }, { status: 400 });
    }
    if (typeof amount !== "string" || !amount) {
      return NextResponse.json({ error: "amount is required" }, { status: 400 });
    }
    const result = await record.sdk.submitFundWithdraw(recipient, amount);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("required") || message.includes("expired") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
