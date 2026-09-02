/**
 * The host half of the Plaee embed contract.
 *
 * **Mirrored from `plaee-ui-mock/src/embed/protocol.ts`.** Kept to types and guards, no logic, so
 * the two copies stay easy to compare. A shared package would misrepresent the relationship: in
 * production the page embedding Plaee belongs to a customer and shares no build with it.
 */
export const PLAEE_SOURCE = "plaee";
export const PROTOCOL_VERSION = 1;

export type ChildMessage =
  | { type: "plaee:ready"; payload: { uiVersion: string } }
  | {
      type: "plaee:session";
      payload: {
        state: "authenticated" | "expired" | "error";
        userId?: string;
        custodyMode?: string;
        transport?: "cookie" | "bearer";
      };
    }
  | { type: "plaee:resize"; payload: { height: number } }
  | { type: "plaee:navigate"; payload: { path: string; title: string } }
  | {
      type: "plaee:order-placed";
      payload: { orderId: string; orderHash: string | null; side: number; status: string };
    }
  | { type: "plaee:error"; payload: { code: string; message: string } };

export type HostMessage =
  | { type: "plaee:host-ready"; payload: { parentOrigin: string } }
  | { type: "plaee:navigate"; payload: { path: string } }
  | { type: "plaee:refresh-balance"; payload: Record<string, never> };

export type PlaeeEnvelope<T> = { source: typeof PLAEE_SOURCE; v: number; type: string; payload: T };

export function envelope<M extends { type: string; payload: unknown }>(
  message: M,
): PlaeeEnvelope<M["payload"]> {
  return {
    source: PLAEE_SOURCE,
    v: PROTOCOL_VERSION,
    type: message.type,
    payload: message.payload,
  };
}

/**
 * Whether `data` is one of ours.
 *
 * Not optional politeness: HMR, React DevTools and every wallet extension post to `window`, so a
 * listener that does not filter is handed their objects and throws on the first property access.
 */
export function isPlaeeMessage(data: unknown): data is PlaeeEnvelope<unknown> {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<PlaeeEnvelope<unknown>>;
  return (
    candidate.source === PLAEE_SOURCE &&
    candidate.v === PROTOCOL_VERSION &&
    typeof candidate.type === "string"
  );
}

export function asChildMessage(data: unknown): ChildMessage | null {
  if (!isPlaeeMessage(data)) return null;
  return data as unknown as ChildMessage;
}
