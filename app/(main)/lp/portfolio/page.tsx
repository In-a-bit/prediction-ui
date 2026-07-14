import type { Metadata } from "next";

import { LpPortfolioPage } from "@/components/lp/lp-portfolio-page";

export const metadata: Metadata = {
  title: "LP Portfolio | DPM",
};

export default function Page() {
  return <LpPortfolioPage />;
}
