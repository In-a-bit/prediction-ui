import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import { requireLpSession } from "@/lib/lp/sdk";

export async function GET() {
  try {
    const jar = await cookies();
    const record = await requireLpSession(jar.get(LP_SESSION_COOKIE)?.value);
    const orders = await record.sdk.fetchOpenOrders();
    return NextResponse.json({ orders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("required") || message.includes("expired") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const record = await requireLpSession(jar.get(LP_SESSION_COOKIE)?.value);
    const body = await req.json();
    const result = await record.sdk.submitOrder(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("required") || message.includes("expired") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
