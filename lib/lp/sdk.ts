import { DpmSdk } from "@inabit-com/dpm-sdk/lp";

import { checkAllowanceAndSignIfNeeded } from "@/lib/allowance";
import { lpUpstreamBase } from "@/lib/lp/direct-urls";
import { truncateApiKey } from "@/lib/lp/format";
import {
  sealLpSession,
  unsealLpSession,
  type LpSealedPayload,
} from "@/lib/lp/session-seal";
import {
  deleteLpSession,
  getLpSession,
  putLpSession,
  type LpSessionRecord,
} from "@/lib/lp/session-store";
import type { LpPublicSession } from "@/lib/lp/types";

export type { LpPublicSession };

function chainIdFromEnv(): number {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return 80002;
}

export type ConnectLpInput = {
  apiPrivateKey: string;
  eoaPrivateKey: string;
};

export function toPublicSession(
  record: LpSessionRecord | undefined,
): LpPublicSession {
  if (!record) {
    return {
      connected: false,
      apiKeyTruncated: null,
      eoaAddress: null,
      proxyWallet: null,
      allowanceStatus: null,
    };
  }
  return {
    connected: true,
    apiKeyTruncated: record.apiKeyTruncated,
    eoaAddress: record.session.eoaAddress,
    proxyWallet: record.session.proxyWallet,
    allowanceStatus: record.session.user.allowanceStatus,
  };
}

export function publicFromSealed(
  payload: LpSealedPayload | null,
): LpPublicSession {
  if (!payload) {
    return {
      connected: false,
      apiKeyTruncated: null,
      eoaAddress: null,
      proxyWallet: null,
      allowanceStatus: null,
    };
  }
  return {
    connected: true,
    apiKeyTruncated: payload.apiKeyTruncated,
    eoaAddress: payload.eoaAddress,
    proxyWallet: payload.proxyWallet,
    allowanceStatus: payload.allowanceStatus,
  };
}

function payloadFromRecord(record: LpSessionRecord): LpSealedPayload {
  return {
    v: 1,
    apiPrivateKey: record.apiPrivateKey,
    eoaPrivateKey: record.eoaPrivateKey,
    apiKeyTruncated: record.apiKeyTruncated,
    eoaAddress: record.session.eoaAddress,
    proxyWallet: record.session.proxyWallet,
    allowanceStatus: record.session.user.allowanceStatus ?? null,
    createdAt: record.createdAt,
  };
}

export function sealRecord(record: LpSessionRecord): string {
  return sealLpSession(payloadFromRecord(record));
}

async function buildSdk(
  apiPrivateKey: string,
  eoaPrivateKey: string,
): Promise<{
  sdk: DpmSdk;
  session: Awaited<ReturnType<DpmSdk["createLpUser"]>>;
}> {
  const sdk = await DpmSdk.create({
    urls: {
      gammaUrl: lpUpstreamBase("gamma"),
      clobUrl: lpUpstreamBase("clob"),
      relayerUrl: lpUpstreamBase("relayer"),
    },
    chainId: chainIdFromEnv(),
    privateKey: eoaPrivateKey,
    apiPrivateKey,
  });
  const session = await sdk.createLpUser();
  return { sdk, session };
}

export type ConnectLpResult = {
  record: LpSessionRecord;
  /** Sealed cookie value (source of truth across serverless instances). */
  sealed: string;
};

export async function connectLpSession(
  input: ConnectLpInput,
): Promise<ConnectLpResult> {
  const apiPrivateKey = input.apiPrivateKey.trim();
  const privateKey = input.eoaPrivateKey.trim();
  if (!apiPrivateKey) throw new Error("apiPrivateKey is required");
  if (!privateKey) throw new Error("eoaPrivateKey is required");

  const { sdk, session } = await buildSdk(apiPrivateKey, privateKey);
  // Fire-and-forget allowance; UI can refresh status.
  void checkAllowanceAndSignIfNeeded(sdk, session.user);

  const draft: LpSessionRecord = {
    id: "",
    sdk,
    session,
    apiKeyTruncated: truncateApiKey(apiPrivateKey),
    apiPrivateKey,
    eoaPrivateKey: privateKey,
    createdAt: Date.now(),
  };
  const sealed = sealRecord(draft);
  const record: LpSessionRecord = { ...draft, id: sealed };
  putLpSession(record);
  return { record, sealed };
}

/** Rebuild SDK from the sealed cookie (or warm in-memory cache). */
export async function requireLpSession(
  cookieValue: string | undefined,
): Promise<LpSessionRecord> {
  if (!cookieValue) throw new Error("LP session required");

  const cached = getLpSession(cookieValue);
  if (cached) return cached;

  const payload = unsealLpSession(cookieValue);
  if (!payload) throw new Error("LP session expired or not found");

  const { sdk, session } = await buildSdk(
    payload.apiPrivateKey,
    payload.eoaPrivateKey,
  );
  const record: LpSessionRecord = {
    id: cookieValue,
    sdk,
    session,
    apiKeyTruncated:
      payload.apiKeyTruncated || truncateApiKey(payload.apiPrivateKey),
    apiPrivateKey: payload.apiPrivateKey,
    eoaPrivateKey: payload.eoaPrivateKey,
    createdAt: payload.createdAt || Date.now(),
  };
  putLpSession(record);
  return record;
}

export async function disconnectLpSession(
  cookieValue: string | undefined,
): Promise<void> {
  if (!cookieValue) return;
  const cached = getLpSession(cookieValue);
  if (cached) {
    try {
      await cached.sdk.auth.logout();
    } catch {
      /* ignore */
    }
    deleteLpSession(cookieValue);
    return;
  }
  const payload = unsealLpSession(cookieValue);
  if (!payload) return;
  try {
    const { sdk } = await buildSdk(
      payload.apiPrivateKey,
      payload.eoaPrivateKey,
    );
    await sdk.auth.logout();
  } catch {
    /* ignore */
  }
}

/** Re-seal after in-session updates (e.g. allowance status). */
export function resealLpSession(record: LpSessionRecord): string {
  deleteLpSession(record.id);
  const sealed = sealRecord(record);
  record.id = sealed;
  putLpSession(record);
  return sealed;
}

export { unsealLpSession };
