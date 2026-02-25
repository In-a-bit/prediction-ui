import { NextRequest, NextResponse } from "next/server";
import {
  fetchOrderBook,
  fetchMidpoint,
  fetchPriceHistory,
} from "@/lib/api/clob";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get("endpoint");
  const tokenId = searchParams.get("token_id");

  if (!tokenId) {
    return NextResponse.json({ error: "token_id is required" }, { status: 400 });
  }

  try {
    switch (endpoint) {
      case "book": {
        const book = await fetchOrderBook(tokenId);
        return NextResponse.json(book);
      }

      case "midpoint": {
        const mid = await fetchMidpoint(tokenId);
        console.log(`[CLOB] midpoint for ${tokenId}: ${mid}`);
        return NextResponse.json({ mid });
      }

      case "prices-history": {
        const startTs = searchParams.get("startTs");
        const endTs = searchParams.get("endTs");
        const fidelity = searchParams.get("fidelity");

        const history = await fetchPriceHistory({
          tokenId,
          startTs: startTs ? parseInt(startTs, 10) : undefined,
          endTs: endTs ? parseInt(endTs, 10) : undefined,
          fidelity: fidelity ? parseInt(fidelity, 10) : undefined,
        });
        return NextResponse.json({ history });
      }

      default:
        return NextResponse.json(
          { error: "Invalid endpoint. Use: book, midpoint, prices-history" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`CLOB proxy error (${endpoint}):`, error);
    if (endpoint === "book") {
      return NextResponse.json({ bids: [], asks: [], timestamp: "" });
    }
    if (endpoint === "midpoint") {
      return NextResponse.json({ mid: "0" });
    }
    if (endpoint === "prices-history") {
      return NextResponse.json({ history: [] });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
