import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { MainShell } from "@/components/layout/main-shell";
import { ActivityWsProvider } from "@/components/providers/activity-ws-provider";
import { SettingsProvider } from "@/components/providers/settings-provider";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SettingsProvider>
      <ActivityWsProvider>
        <div className="flex min-h-screen bg-background">
          <Suspense>
            <Sidebar />
          </Suspense>
          <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
            <Suspense>
              <MainShell>{children}</MainShell>
            </Suspense>
          </main>
        </div>
      </ActivityWsProvider>
    </SettingsProvider>
  );
}
