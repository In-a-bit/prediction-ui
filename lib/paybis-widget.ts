/**
 * Loader and thin wrapper around the Paybis Web SDK.
 *
 * The SDK is a plain <script> that installs `window.PartnerExchangeWidget`, so
 * it cannot be imported as a module. We reproduce the bootstrap snippet from the
 * Paybis docs: a stub is installed first so an `open()` call made before the
 * real script arrives is queued rather than lost.
 *
 * The widget must be opened in an iframe overlay (the default `open()`), because
 * SDK events — which the off-ramp handoff depends on — are not delivered when
 * the widget is opened via redirect.
 */

const SANDBOX_WIDGET_URL = "https://widget.sandbox.paybis.com";

/** Events the SDK exposes on `PartnerExchangeWidget.events`. */
export type PaybisEventName =
  | "onopened"
  | "onloaded"
  | "onclosed"
  | "onerror"
  | "oncompleted"
  | "oncancelled"
  | "onrejected"
  | "onstartnewtransaction"
  | "onpayoutwaiting"
  | "onpaymentinitiated";

type PaybisEventHandler = (payload?: unknown) => void;

export type PaybisOpenOptions = {
  requestId: string;
  /** Only used with Paybis single sign-on, and never when re-opening a widget. */
  oneTimeToken?: string;
};

type PartnerExchangeWidget = {
  open: (options: PaybisOpenOptions) => void;
  close?: () => void;
  events?: Partial<Record<PaybisEventName, PaybisEventHandler>>;
  isLoaded?: boolean;
  state?: string;
};

declare global {
  interface Window {
    PartnerExchangeWidget?: PartnerExchangeWidget;
    partnerWidgetSettings?: { immediateOpen?: PaybisOpenOptions };
  }
}

const SCRIPT_ID = "paybis-partner-exchange-widget";
const LOAD_TIMEOUT_MS = 15_000;

/** Base origin of the Paybis widget; sandbox unless overridden. */
export function paybisWidgetOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_PAYBIS_WIDGET_URL?.trim();
  return (configured || SANDBOX_WIDGET_URL).replace(/\/$/, "");
}

/**
 * The real SDK object identifies itself by constructor name; the pre-load stub
 * does not. This is how the Paybis bootstrap snippet itself tells them apart.
 */
function isRealWidget(widget: PartnerExchangeWidget | undefined): boolean {
  return widget?.constructor?.name === "PartnerExchangeWidget";
}

let loadPromise: Promise<PartnerExchangeWidget> | null = null;

/** Injects the SDK if needed and resolves once it has taken over `window`. */
export function loadPaybisWidget(): Promise<PartnerExchangeWidget> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paybis widget requires a browser"));
  }
  if (isRealWidget(window.PartnerExchangeWidget)) {
    return Promise.resolve(window.PartnerExchangeWidget!);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<PartnerExchangeWidget>((resolve, reject) => {
    // Queue an early open() instead of throwing, matching the vendor snippet.
    window.PartnerExchangeWidget ??= {
      open(options: PaybisOpenOptions) {
        window.partnerWidgetSettings = { immediateOpen: options };
      },
    };

    const settle = () => {
      if (!isRealWidget(window.PartnerExchangeWidget)) return false;
      clearInterval(poll);
      clearTimeout(timeout);
      resolve(window.PartnerExchangeWidget!);
      return true;
    };

    const fail = (message: string) => {
      clearInterval(poll);
      clearTimeout(timeout);
      // Allow a later retry rather than caching the failure forever.
      loadPromise = null;
      reject(new Error(message));
    };

    // The script installs the real object asynchronously after its own load
    // event, so polling is more reliable than onload alone.
    const poll = setInterval(settle, 100);
    const timeout = setTimeout(
      () => fail("Paybis widget failed to load in time"),
      LOAD_TIMEOUT_MS,
    );

    if (document.getElementById(SCRIPT_ID)) {
      settle();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.type = "text/javascript";
    script.defer = true;
    script.src = `${paybisWidgetOrigin()}/partner-exchange-widget.js`;
    script.onerror = () => fail("Could not load the Paybis widget script");
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Loads the SDK if necessary, then opens the widget in a full-screen overlay. */
export async function openPaybisWidget(
  options: PaybisOpenOptions,
): Promise<void> {
  const widget = await loadPaybisWidget();
  widget.open(options);
}

export function closePaybisWidget(): void {
  window.PartnerExchangeWidget?.close?.();
}

/**
 * Subscribes to an SDK event and returns an unsubscribe function.
 *
 * The SDK exposes single-slot handler properties rather than addEventListener,
 * so any existing handler is preserved and chained instead of overwritten.
 */
export function onPaybisEvent(
  widget: PartnerExchangeWidget,
  name: PaybisEventName,
  handler: PaybisEventHandler,
): () => void {
  widget.events ??= {};
  const events = widget.events;
  const previous = events[name];

  events[name] = (payload?: unknown) => {
    previous?.(payload);
    handler(payload);
  };

  return () => {
    events[name] = previous;
  };
}
