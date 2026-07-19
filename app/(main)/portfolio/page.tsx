import type { Metadata } from "next";
import { PortfolioClientPage } from "@/components/portfolio/portfolio-client-page";

export const metadata: Metadata = {
  title: "Portfolio | DPM",
};

export default function PortfolioPage() {
  return <PortfolioClientPage />;
}
