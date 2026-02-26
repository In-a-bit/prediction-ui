import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MarketWSProvider } from "@/components/providers/market-ws-provider";

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MarketWSProvider>
      <div className="flex min-h-screen bg-background">
        <Suspense>
          <Sidebar />
        </Suspense>
        <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
          <Suspense>
            <Header />
          </Suspense>
          {children}
        </main>
      </div>
    </MarketWSProvider>
  );
}
