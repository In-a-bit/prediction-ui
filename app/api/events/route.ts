import { NextRequest, NextResponse } from "next/server";
import { fetchEvents } from "@/lib/api/gamma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const params: Record<string, string | number | boolean> = {};
  const active = searchParams.get("active");
  const closed = searchParams.get("closed");
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");
  const order = searchParams.get("order");
  const ascending = searchParams.get("ascending");
  const tag = searchParams.get("tag");

  if (active !== null) params.active = active === "true";
  if (closed !== null) params.closed = closed === "true";
  if (limit !== null) params.limit = parseInt(limit, 10);
  if (offset !== null) params.offset = parseInt(offset, 10);
  if (order !== null) params.order = order;
  if (ascending !== null) params.ascending = ascending === "true";
  if (tag !== null) params.tag = tag;

  try {
    const events = await fetchEvents(params);
    return NextResponse.json(events);
  } catch (error) {
    console.error("Events proxy error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
