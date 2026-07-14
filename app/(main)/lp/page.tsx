import { PlaeEventGrid } from "@/components/plae/plae-event-grid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LP | DPM",
};

export default function LpPage() {
  return (
    <>
      <section className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground">LP</h1>
        <p className="text-sm text-muted">
          Liquidity provider demo — connect an LP API key + EOA, then trade via
          dpm-sdk server-side (direct to prediction-go with X-LP-* headers).
        </p>
      </section>

      <section>
        <PlaeEventGrid />
      </section>
    </>
  );
}
