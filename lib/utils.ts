import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats on-chain / normalized USDC-style balance for display: strips trailing zeros
 * after the decimal (e.g. "2.000" → "$2", "2.003" → "$2.003").
 */
export function formatTradeBalanceUsd(
  normalized: string | null | undefined,
): string {
  if (normalized == null || normalized === "") return "—";
  const n = Number(normalized);
  if (Number.isNaN(n)) return "—";
  const trimmed = n.toFixed(6).replace(/\.?0+$/, "");
  return `$${trimmed}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Copies text; uses Clipboard API when available, otherwise a textarea fallback. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.readOnly = true;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const execCommand = Reflect.get(
      Document.prototype,
      "execCommand",
    ) as (this: Document, commandId: string, showUI?: boolean, value?: string | null) => boolean;
    const ok = execCommand.call(document, "copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
