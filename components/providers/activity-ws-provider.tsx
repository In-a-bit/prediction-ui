"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import {
  ActivityToasterProvider,
  useActivityToaster,
} from "@/components/activity/activity-toaster";
import { useActivityWs } from "@/lib/hooks/use-activity-ws";

/** Query param that toggles the activity popup (e.g. ?showActivity=true). */
const SHOW_ACTIVITY_PARAM = "showActivity";

/** Reads the builder publishable key from the public env, or null when unset. */
function builderApiPublicKeyFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_BUILDER_API_PUBLIC_KEY?.trim();
  return raw || null;
}

/** True only when the flag is present AND truthy (true/1/yes). */
function isShowActivityEnabled(value: string | null): boolean {
  if (value === null) return false;
  return ["true", "1", "yes"].includes(value.trim().toLowerCase());
}

/**
 * Always connects to the builder-scoped activity WebSocket (demo behaviour) and
 * logs every frame. The ?showActivity flag only controls whether frames are
 * surfaced as side toasts — the connection is opened regardless.
 */
function ActivityWsBridge({ builderKey }: { builderKey: string }) {
  const { push } = useActivityToaster();
  const searchParams = useSearchParams();
  const showToaster = isShowActivityEnabled(searchParams.get(SHOW_ACTIVITY_PARAM));

  useActivityWs({
    builderKey,
    enabled: true,
    onEvent: (event) => {
      console.log("[Activity WS] event:", event);
      if (showToaster) push(event);
    },
  });
  return null;
}

/**
 * Subscribes to the builder-scoped activity stream whenever
 * NEXT_PUBLIC_BUILDER_API_PUBLIC_KEY is configured. The connection is always
 * opened (demo); the ?showActivity=true URL flag only toggles the visual
 * toaster. Renders children only when the builder key is absent.
 *
 * useSearchParams (in the bridge) requires a Suspense boundary during prerender.
 */
export function ActivityWsProvider({ children }: { children: React.ReactNode }) {
  const builderKey = builderApiPublicKeyFromEnv();
  return (
    <>
      {children}
      {builderKey ? (
        <ActivityToasterProvider>
          <Suspense fallback={null}>
            <ActivityWsBridge builderKey={builderKey} />
          </Suspense>
        </ActivityToasterProvider>
      ) : null}
    </>
  );
}
