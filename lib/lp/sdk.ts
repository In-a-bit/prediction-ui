import { randomUUID } from "crypto";
import { DpmSdk } from "@inabit-com/dpm-sdk/lp";

import { checkAllowanceAndSignIfNeeded } from "@/lib/allowance";
import { lpUpstreamBase } from "@/lib/lp/direct-urls";
import { truncateApiKey } from "@/lib/lp/format";
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

export async function connectLpSession(
  input: ConnectLpInput,
): Promise<LpSessionRecord> {
  const apiPrivateKey = input.apiPrivateKey.trim();
  const privateKey = input.eoaPrivateKey.trim();
  if (!apiPrivateKey) throw new Error("apiPrivateKey is required");
  if (!privateKey) throw new Error("eoaPrivateKey is required");

  const sdk = await DpmSdk.create({
    urls: {
      gammaUrl: lpUpstreamBase("gamma"),
      clobUrl: lpUpstreamBase("clob"),
      relayerUrl: lpUpstreamBase("relayer"),
    },
    chainId: chainIdFromEnv(),
    privateKey,
    apiPrivateKey,
  });

  const session = await sdk.createLpUser();
  // Fire-and-forget allowance; UI can refresh status.
  void checkAllowanceAndSignIfNeeded(sdk, session.user);

  const record: LpSessionRecord = {
    id: randomUUID(),
    sdk,
    session,
    apiKeyTruncated: truncateApiKey(apiPrivateKey),
    apiPrivateKey,
    eoaPrivateKey: privateKey,
    createdAt: Date.now(),
  };
  putLpSession(record);
  return record;
}

export function requireLpSession(sessionId: string | undefined): LpSessionRecord {
  if (!sessionId) throw new Error("LP session required");
  const record = getLpSession(sessionId);
  if (!record) throw new Error("LP session expired or not found");
  return record;
}

export async function disconnectLpSession(sessionId: string): Promise<void> {
  const record = getLpSession(sessionId);
  if (!record) return;
  try {
    await record.sdk.auth.logout();
  } catch {
    /* ignore */
  }
  deleteLpSession(sessionId);
}
