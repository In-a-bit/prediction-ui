import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const conditionId = searchParams.get("conditionId");
  const limit = parseInt(searchParams.get("limit") ?? "15", 10);

  if (!conditionId) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const trades = await prisma.trade.findMany({
      where: { conditionId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        side: true,
        outcome: true,
        price: true,
        shares: true,
        createdAt: true,
      },
    });

    const result = trades.map((t) => ({
      id: t.id,
      side: t.side,
      outcome: t.outcome,
      price: t.price,
      size: t.shares,
      timestamp: t.createdAt.toISOString(),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Trades API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
