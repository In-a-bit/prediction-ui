/** Parse decimal strings from CLOB REST/WS (human-readable, not fixed-point integers). */
export function parseWireDecimal(raw: string): number {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}
