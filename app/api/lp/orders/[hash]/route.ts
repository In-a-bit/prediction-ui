import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import { requireLpSession } from "@/lib/lp/sdk";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await ctx.params;
    const url = new URL(req.url);
    const marketId = url.searchParams.get("marketId") ?? url.searchParams.get("market_id");
    if (!marketId) {
      return NextResponse.json({ error: "marketId is required" }, { status: 400 });
    }
    const jar = await cookies();
    const record = requireLpSession(jar.get(LP_SESSION_COOKIE)?.value);
    const result = await record.sdk.cancelOrder(hash, marketId);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("required") || message.includes("expired") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
