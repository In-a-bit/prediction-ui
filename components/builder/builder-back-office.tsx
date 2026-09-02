"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ModeBadge } from "@/components/builder/mode-badge";
import { TreasuryPanel } from "@/components/builder/treasury-panel";
import { CustomerTable } from "@/components/builder/customer-table";
import { fetchManagedUsers, fetchSiteConfig, fetchTreasury } from "@/lib/builder/client";
import type { BuilderMode, ManagedUser, Treasury } from "@/lib/builder/types";

/**
 * Staff tooling for one builder: its customers, its books, and its platform wallets.
 *
 * The two halves load independently and fail independently. The wallet half depends on Plaee, a
 * wallet-manager and a chain read; losing the customer list with it would make an outage harder to
 * work through rather than easier.
 */
export function BuilderBackOffice({ mode }: { mode: BuilderMode }) {
  const [name, setName] = useState<string | null>(null);
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [treasuryError, setTreasuryError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await fetchManagedUsers(mode));
      setUsersError(null);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "Could not load customers");
    }
  }, [mode]);

  const loadTreasury = useCallback(async () => {
    try {
      const result = await fetchTreasury(mode);
      setTreasury(result.treasury);
      setTreasuryError(result.error);
    } catch (err) {
      setTreasuryError(err instanceof Error ? err.message : "Could not load the treasury");
    }
  }, [mode]);

  useEffect(() => {
    void fetchSiteConfig(mode).then(
      (config) => setName(config.builderName),
      () => setName(null),
    );
    void loadUsers();
    void loadTreasury();
  }, [mode, loadUsers, loadTreasury]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-card-border bg-card px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted">Back office</span>
            <ModeBadge mode={mode} />
          </div>
          <h1 className="mt-1 text-lg font-semibold">{name ?? "This builder"}</h1>
        </div>
        <Link
          href={`/builder/${mode}`}
          className="rounded-md border border-card-border px-3 py-1.5 text-xs hover:bg-card-hover"
        >
          Back to the site
        </Link>
      </header>

      <TreasuryPanel
        mode={mode}
        treasury={treasury}
        error={treasuryError}
        onChanged={loadTreasury}
      />

      <CustomerTable
        mode={mode}
        users={users}
        error={usersError}
        onChanged={() => {
          void loadUsers();
        }}
      />
    </div>
  );
}
