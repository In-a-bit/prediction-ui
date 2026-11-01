import { NextResponse, type NextRequest } from "next/server";

import { isBuilderEnabled } from "@/lib/builder/config";

/**
 * Keeps `/builder` unreachable when the demo is off.
 *
 * A proxy rather than `notFound()` in the builder layout: that layout renders inside the Suspense
 * boundary in `(main)/layout.tsx`, so the response would still be a 200 carrying the page's content
 * in its payload, with only the visible screen saying 404.
 */
export function proxy(request: NextRequest) {
  if (isBuilderEnabled()) return NextResponse.next();
  // No route answers this path, so Next serves its own 404 page with a real 404 status.
  return NextResponse.rewrite(new URL("/__builder-disabled", request.url));
}

export const config = {
  // Not `/builder/:path*`: this also has to catch `/builder.rsc`, the page's prerendered payload.
  matcher: "/builder(.*)",
};
