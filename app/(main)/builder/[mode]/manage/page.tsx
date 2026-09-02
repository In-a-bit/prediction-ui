import { notFound } from "next/navigation";

import { BuilderBackOffice } from "@/components/builder/builder-back-office";
import { isBuilderMode } from "@/lib/builder/config";

/**
 * The builder's own back office.
 *
 * Its customers and books come from the builder's operator; its platform wallets come from the
 * wallet-manager it runs, asked through Plaee, which is where that credential was submitted.
 */
export default async function BuilderManagePage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  if (!isBuilderMode(mode)) notFound();
  return <BuilderBackOffice mode={mode} />;
}
