import type { AuthSession, DpmSdk } from "@inabit-com/dpm-sdk/lp";

export type LpSessionRecord = {
  id: string;
  sdk: DpmSdk;
  session: AuthSession;
  apiKeyTruncated: string;
  /** Full API key kept only in memory for reconnect/display helpers. */
  apiPrivateKey: string;
  eoaPrivateKey: string;
  createdAt: number;
};

const globalStore = globalThis as typeof globalThis & {
  __lpSessionStore?: Map<string, LpSessionRecord>;
};

function store(): Map<string, LpSessionRecord> {
  if (!globalStore.__lpSessionStore) {
    globalStore.__lpSessionStore = new Map();
  }
  return globalStore.__lpSessionStore;
}

export function putLpSession(record: LpSessionRecord): void {
  store().set(record.id, record);
}

export function getLpSession(id: string): LpSessionRecord | undefined {
  return store().get(id);
}

export function deleteLpSession(id: string): void {
  store().delete(id);
}
