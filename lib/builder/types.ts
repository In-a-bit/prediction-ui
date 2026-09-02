/**
 * The two custody builders the demo offers, and where each one's backend lives.
 *
 * Fixed rather than configurable: the point of the tab is to show the same integration under both
 * custody models, so "which builder" is a choice between two, not a form field.
 */
export type BuilderMode = "segregated" | "shared";

export type BuilderSiteConfig = {
  builderName: string;
  custodyMode: BuilderMode;
  /** Which Plaee this builder is integrated with. Read from the builder's own env, never set here. */
  plaeeBaseUrl: string;
  plaeeConfigured: boolean;
};

/**
 * A customer's money, in the two places it can be.
 *
 * `cashMicro` is null in shared custody, and that is the difference between the modes rather than
 * missing data: there the builder's ledger *is* the money, so there is one pot. In segregated
 * custody there are two, and moving between them sends real USDC on chain.
 *
 * `source` says where the prediction figure came from — `chain` and `ledger` are authoritative,
 * `mirror` means the local copy answered because Plaee could not be reached.
 */
export type SiteBalances = {
  cashMicro: string | null;
  predictionsMicro: string;
  reservedMicro: string;
  source: "ledger" | "chain" | "mirror";
};

export type CustomerProfile = BuilderSiteConfig & {
  id: string;
  email: string;
  displayName: string | null;
  /** Null until they first open prediction markets — a DPM wallet is provisioned lazily. */
  plaeeUserId: string | null;
  balances: SiteBalances;
};

/** Submitted, not settled: a relayed transfer becomes true when it mines. */
export type TransferResult = {
  state: "settled" | "submitted";
  cashBalanceMicro: string;
  relayerTxId?: string;
  detail: string;
  balances: SiteBalances;
};

export type CashEntry = {
  id: string;
  kind: "deposit" | "payout" | "to_predictions" | "from_predictions" | "adjustment";
  amountMicro: string;
  balanceAfterMicro: string;
  reference: string | null;
  createdAt: string;
};

/**
 * What happens when a customer asks for prediction markets.
 *
 * `provisioning` is an ordinary answer, not an error: the first request mints a DPM wallet, which
 * takes two on-chain transactions.
 */
export type PredictionSession =
  | { state: "ready"; iframeUrl: string; expiresAt: string }
  | { state: "provisioning"; detail: string }
  | { state: "failed"; detail: string }
  | { state: "unavailable"; detail: string };

// ── The builder's back office ────────────────────────────────────────────────

export type ManagedUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  plaeeUserId: string | null;
  cashMicro: string | null;
  predictionsMicro: string;
  reservedMicro: string;
};

/** A platform wallet with what the chain says it holds. */
export type TreasuryWallet = {
  id: string;
  kind: "user" | "master" | "operations";
  externalId: string | null;
  label: string | null;
  status: string;
  /** The EOA that signs. */
  address: string | null;
  /** Where funds actually sit. */
  proxyAddress: string | null;
  dpmRegistered: boolean;
  balanceMicro: string | null;
  balanceError: string | null;
};

export type WalletManagerKey = {
  id: string;
  name: string;
  role: string;
  status: string;
  /** The non-secret handle. The value is shown once, at creation, and never again. */
  prefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
};

export type Treasury = {
  mode: BuilderMode;
  modeBurnedAt: string;
  walletCount: number;
  upstream: { reachable: boolean; vault: { initialized: boolean; ready: boolean } };
  masterWallet: TreasuryWallet | null;
  operationsWallet: TreasuryWallet | null;
  apiKeys: WalletManagerKey[];
  apiKeysError: string | null;
};
