import { notFound } from "next/navigation";

import { BuilderSite } from "@/components/builder/builder-site";
import { isBuilderMode } from "@/lib/builder/config";

/**
 * One builder's website, as its own customer sees it.
 *
 * Everything past this point is the builder's surface, not Plaee's: its brand, its sign-up, its
 * customers. Plaee only appears once someone opens prediction markets, inside an iframe.
 */
export default async function BuilderSitePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!isBuilderMode(mode)) notFound();
  return <BuilderSite mode={mode} />;
}
