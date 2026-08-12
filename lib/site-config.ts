/**
 * Build-time UI toggles.
 *
 * These control what the interface *offers*, not what the platform supports.
 * Changing one requires an edit and a redeploy — deliberately, so a toggle is a
 * reviewed change rather than something flipped invisibly in deploy settings.
 */
export const siteConfig = {
  /**
   * Show the recipient address input in the trade panel.
   *
   * An order's recipient receives its proceeds — the outcome shares on a buy, the
   * collateral on a sell — while the maker remains the source of funds, pays the
   * fee, and keeps sole cancel rights. Leaving it unset pays the maker.
   *
   * The field is supported end-to-end regardless of this flag: the SDK signs it,
   * the API accepts it, and orders routed to you show up in your open orders. This
   * only controls whether the trade panel lets a user type one in, so turning it
   * off does not disable the capability for API clients.
   */
  showOrderRecipientInput: false,
} as const;
