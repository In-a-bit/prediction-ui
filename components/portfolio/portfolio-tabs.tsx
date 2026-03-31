"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const TABS = ["Positions", "Open orders", "History"] as const;
type Tab = (typeof TABS)[number];

export function PortfolioTabs({
  positionsContent,
  openOrdersContent,
  historyContent,
}: {
  positionsContent: React.ReactNode;
  openOrdersContent: React.ReactNode;
  historyContent: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Positions");
  const [positionsKey, setPositionsKey] = useState(0);
  const [openOrdersKey, setOpenOrdersKey] = useState(0);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "Positions") setPositionsKey((k) => k + 1);
    if (tab === "Open orders") setOpenOrdersKey((k) => k + 1);
  };

  const content: Record<Tab, React.ReactNode> = {
    Positions: <div key={positionsKey}>{positionsContent}</div>,
    "Open orders": <div key={openOrdersKey}>{openOrdersContent}</div>,
    History: historyContent,
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-card-border px-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={cn(
              "relative px-4 py-3.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "text-foreground"
                : "text-muted hover:text-foreground"
            )}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand" />
            )}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      {content[activeTab]}
    </div>
  );
}
