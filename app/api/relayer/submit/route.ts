import { NextRequest, NextResponse } from "next/server";

const RELAYER_API_URL =
  process.env.RELAYER_API_URL ??
  process.env.NEXT_PUBLIC_RELAYER_API_URL ??
  "http://localhost:8085";

const APP_API_KEY = process.env.APP_API_KEY?.trim();

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const from = (body as { from?: string }).from;
  if (!from || typeof from !== "string") {
    return NextResponse.json(
      { error: "body.from is required (signer address)" },
      { status: 400 }
    );
  }

  if (!APP_API_KEY) {
    console.error("[relayer/submit] POST: APP_API_KEY is not set");
    return NextResponse.json(
      { error: "Server misconfigured: APP_API_KEY required" },
      { status: 500 },
    );
  }

  const cookie = request.headers.get("cookie") ?? "";
  const url = `${RELAYER_API_URL.replace(/\/$/, "")}/submit`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": APP_API_KEY,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: `Relayer API error (${res.status}): ${text}` },
      { status: res.status }
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON from relayer" },
      { status: 502 }
    );
  }

  return NextResponse.json(data);
}
