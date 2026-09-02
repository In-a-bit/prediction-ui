"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { asChildMessage, envelope, type ChildMessage } from "@/lib/builder/embed-protocol";

const MIN_HEIGHT = 620;
/** Below this a resize is noise, and echoing it back is how a resize feedback loop starts. */
const RESIZE_EPSILON = 4;

type LogLine = { at: string; text: string };

/**
 * Plaee, embedded in the builder's page.
 *
 * The listener is attached before `src` is set, and the child re-posts `ready` until it hears
 * `host-ready`, so neither side can lose the handshake to a mount race. Every message is checked
 * against the frame's own origin *and* the sending window: `postMessage` reaches any listener on
 * the page, and extensions post to it constantly.
 */
export function PlaeeEmbed({ src }: { src: string }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [status, setStatus] = useState("connecting…");
  const [log, setLog] = useState<LogLine[]>([]);

  /**
   * `parentOrigin` is added here rather than by Plaee: only the page doing the embedding knows
   * where it is served from. The child validates it against its own allowlist, which is what keeps
   * a query parameter from being the vulnerability.
   */
  const framedSrc = useMemo(() => {
    const url = new URL(src);
    url.searchParams.set("parentOrigin", window.location.origin);
    return url.toString();
  }, [src]);

  const childOrigin = useMemo(() => new URL(src).origin, [src]);

  useEffect(() => {
    const record = (text: string) =>
      setLog((lines) =>
        [{ at: new Date().toLocaleTimeString(), text }, ...lines].slice(0, 12),
      );

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== childOrigin) return;
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = asChildMessage(event.data);
      if (!message) return;

      handle(message, { record, setStatus, setHeight });

      if (message.type === "plaee:ready") {
        frame.current.contentWindow?.postMessage(
          envelope({
            type: "plaee:host-ready" as const,
            payload: { parentOrigin: window.location.origin },
          }),
          childOrigin,
        );
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [childOrigin]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-card-border bg-card px-4 py-2 text-xs">
        <span className="text-muted">
          Plaee · <span className="font-mono">{childOrigin}</span>
        </span>
        <span className="rounded-full bg-input px-2 py-0.5 font-medium">{status}</span>
      </div>
      <iframe
        ref={frame}
        src={framedSrc}
        title="Prediction markets"
        style={{ height }}
        className="-mt-3 w-full rounded-b-lg border border-card-border bg-background"
        // allow-same-origin is required for the child to keep a cookie and to report a real
        // event.origin; without it the frame gets an opaque origin and the handshake cannot work.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
      {log.length > 0 && (
        <details className="rounded-lg border border-card-border bg-card px-4 py-2 text-xs">
          <summary className="cursor-pointer text-muted">postMessage log</summary>
          <ul className="mt-2 space-y-1 font-mono">
            {log.map((line, index) => (
              <li key={`${line.at}-${index}`} className="text-muted">
                <span className="text-foreground">{line.at}</span> {line.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function handle(
  message: ChildMessage,
  ctx: {
    record: (text: string) => void;
    setStatus: (status: string) => void;
    setHeight: (update: (current: number) => number) => void;
  },
) {
  switch (message.type) {
    case "plaee:ready":
      ctx.record(`ready · ui ${message.payload.uiVersion}`);
      return;
    case "plaee:session":
      ctx.setStatus(
        message.payload.state === "authenticated"
          ? `signed in · ${message.payload.transport ?? "cookie"}`
          : message.payload.state,
      );
      ctx.record(`session · ${message.payload.state}`);
      return;
    case "plaee:resize":
      ctx.setHeight((current) => {
        const next = Math.max(MIN_HEIGHT, Math.round(message.payload.height));
        return Math.abs(next - current) < RESIZE_EPSILON ? current : next;
      });
      return;
    case "plaee:navigate":
      ctx.record(`navigate · ${message.payload.path}`);
      return;
    case "plaee:order-placed":
      ctx.record(`order · ${message.payload.status} ${message.payload.orderId}`);
      return;
    case "plaee:error":
      ctx.record(`error · ${message.payload.code} ${message.payload.message}`);
      return;
  }
}
