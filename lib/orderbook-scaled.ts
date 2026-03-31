/**
 * CLOB REST returns decimal prices; sizes are passed through as stored (raw strings).
 * Engine WebSocket sends 1e18-scaled integer strings for price; sizes are unchanged on the wire.
 */

export function scaledIntStringToDecimal(raw: string, scale: number): string {
  if (raw.includes(".") || /[eE]/.test(raw)) return raw;
  try {
    let v = BigInt(raw);
    const neg = v < 0n;
    if (neg) v = -v;
    const base = 10n ** BigInt(scale);
    const whole = v / base;
    const rem = v % base;
    if (rem === 0n) return (neg ? "-" : "") + whole.toString();
    let frac = rem.toString().padStart(scale, "0").replace(/0+$/, "");
    return (neg ? "-" : "") + `${whole}.${frac}`;
  } catch {
    return raw;
  }
}

/** Normalize a book level from WS: price ÷1e18, size ÷1e6. */
export function normalizeWsBookLevel(entry: {
  price: string;
  size: string;
}): { price: string; size: string } {
  return {
    price: scaledIntStringToDecimal(String(entry.price), 18),
    size: scaledIntStringToDecimal(String(entry.size), 6),
  };
}

/** Parse a 1e18-scaled integer price string from WS into a decimal number. */
export function normalizeWsPrice(raw: string): number {
  return parseFloat(scaledIntStringToDecimal(raw, 18));
}

/** Parse a 1e6-scaled integer size string from WS into a decimal number. */
export function normalizeWsSize(raw: string): number {
  return parseFloat(scaledIntStringToDecimal(raw, 6));
}

/** After GET /book: scale integer price strings; size is left as-is. */
export function normalizeRestBookLevel(entry: {
  price: string;
  size: string;
}): { price: string; size: string } {
  const price = String(entry.price);
  const size = String(entry.size);
  return {
    price: price.includes(".") ? price : scaledIntStringToDecimal(price, 18),
    size,
  };
}
