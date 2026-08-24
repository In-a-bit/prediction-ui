import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAddress } from "viem";

import { LP_SESSION_COOKIE } from "@/lib/lp/format";
import { withdrawSharesViaFactory } from "@/lib/lp/direct-proxy-withdraw";
import { requireLpSession } from "@/lib/lp/sdk";

export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const record = await requireLpSession(jar.get(LP_SESSION_COOKIE)?.value);
    const body = await req.json();
    const tokenId = body?.tokenId;
    const amount = body?.amount;
    const recipient = body?.recipient;
    if (typeof tokenId !== "string" || !tokenId) {
      return NextResponse.json({ error: "tokenId is required" }, { status: 400 });
    }
    if (typeof amount !== "string" || !amount) {
      return NextResponse.json({ error: "amount is required" }, { status: 400 });
    }
    if (typeof recipient !== "string" || !isAddress(recipient)) {
      return NextResponse.json({ error: "recipient must be an address" }, { status: 400 });
    }
    const proxyWallet = record.session.proxyWallet;
    if (!proxyWallet) {
      return NextResponse.json({ error: "no proxy wallet on session" }, { status: 400 });
    }
    const result = await withdrawSharesViaFactory({
      eoaPrivateKey: record.eoaPrivateKey,
      proxyWallet,
      recipient,
      tokenId,
      amountDecimal: amount,
    });
    return NextResponse.json({
      transactionHash: result.transactionHash,
      state: "mined",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("required") || message.includes("expired") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
