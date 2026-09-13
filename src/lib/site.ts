/**
 * Every user-visible mention of the brand resolves here. Renaming the project
 * is this file plus the env prefix (`NEXT_PUBLIC_CLIPR_*`), `package.json` and
 * the README — nothing in `components/` or `app/` spells the name out.
 *
 * "Clipper", "campaign", "brand" elsewhere in the copy are the category nouns
 * of the trade (they are Whop's words too) and stay put whatever this is
 * called.
 */
export const site = {
  /** Placeholder name — not final. The all-caps lockup. */
  name: "CLIPR",
  /** Lower-case form for the wordmark. */
  wordmark: "clipr",
  /** The token symbol, shown after every amount. */
  ticker: "CLIPR",
  tagline: "Clip. Post. Get paid per 1,000 views.",
  description:
    "A clipping marketplace where every campaign budget is escrowed onchain and every payout lands in your wallet — in CLIPR.",
  domain: "clipr.xyz",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://clipr.xyz",
  xHandle: process.env.NEXT_PUBLIC_CLIPR_X ?? "cliprxyz",
  get xUrl() {
    return `https://x.com/${this.xHandle}`;
  },
} as const;

/**
 * The economics. These are decisions, not facts — the fee and the grace
 * period must match what the escrow contract was deployed with, and the
 * tracking window is the platform's policy.
 */
export const economics = {
  /** Platform fee charged on top of every deposit, in basis points. */
  feeBps: Number(process.env.NEXT_PUBLIC_CLIPR_FEE_BPS ?? 500),
  /** Days a submission's views are tracked before it is settled. */
  trackingDays: Number(process.env.NEXT_PUBLIC_CLIPR_TRACKING_DAYS ?? 7),
  /** Days a closed campaign keeps honouring vouchers (ClipEscrow.GRACE_PERIOD). */
  gracePeriodDays: 7,
  /** Days a signed voucher stays valid. Must fit inside the grace period. */
  voucherDays: 7,
  /**
   * Optional reference price, USD per CLIPR, for the "≈ $" hints in the
   * launch wizard. Unset means the hints are simply not shown — nothing on
   * the site invents a price.
   */
  usdPerToken: (() => {
    const n = Number(process.env.NEXT_PUBLIC_CLIPR_USD);
    return Number.isFinite(n) && n > 0 ? n : null;
  })(),
} as const;

export const themeColor = "#07070b";
