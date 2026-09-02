/**
 * Micro-units are strings because they are exact; only the display is allowed to be lossy.
 *
 * Parsing through BigInt rather than Number keeps the conversion honest right up to the last step,
 * which matters because these values come from a ledger.
 */
export function formatUsd(micro: string | null | undefined): string {
  if (micro === null || micro === undefined || micro === "") return "$0.00";
  const value = Number(BigInt(micro)) / 1_000_000;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Signed, for a statement line that took money out as readily as one that put it in. */
export function formatSignedUsd(micro: string): string {
  const amount = BigInt(micro);
  const formatted = formatUsd((amount < 0n ? -amount : amount).toString());
  return `${amount < 0n ? "−" : "+"}${formatted}`;
}

/** True when a decimal amount string is a positive number this service can represent. */
export function isValidAmount(value: string): boolean {
  return /^\d+(\.\d{1,6})?$/.test(value.trim()) && Number(value) > 0;
}
