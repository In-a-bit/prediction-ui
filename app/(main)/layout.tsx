import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
  );
}
