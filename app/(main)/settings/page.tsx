import type { Metadata } from "next";
import { SettingsClientPage } from "@/components/settings/settings-client-page";

export const metadata: Metadata = {
  title: "Settings | DPM",
};

export default function SettingsPage() {
  return <SettingsClientPage />;
}
