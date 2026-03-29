import { PlaeEventGrid } from "@/components/plae/plae-event-grid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plaee | DPM",
};

export default function PlaePage() {
  return (
    <>
      <section className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Plaee</h1>
        <p className="text-sm text-muted">
          Prediction markets powered by inabit — trade on real-world events.
        </p>
      </section>

      <section>
        <PlaeEventGrid />
      </section>
    </>
  );
}
