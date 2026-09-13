/**
 * The domain, shared by server and client. Amounts are CLIPR in wei (18
 * decimals) carried as decimal strings — JSON has no bigint — and turned into
 * bigint at the edges. Nothing in here touches the database or the chain.
 */

export const PLATFORMS = ["tiktok", "instagram", "youtube", "x"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  youtube: "YouTube Shorts",
  x: "X",
};

export const CAMPAIGN_TYPES = ["clipping", "ugc"] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  clipping: "Clipping",
  ugc: "UGC",
};

export const CATEGORIES = [
  "Music",
  "Podcast",
  "Streaming",
  "Gaming",
  "Crypto",
  "Sports",
  "Education",
  "Brand",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * pending_budget — recorded, waiting for the escrow deposit (live mode only)
 * active         — taking submissions
 * closed         — the brand closed it; earned vouchers still settle during
 *                  the grace period, then the remainder goes back
 */
export type CampaignStatus = "pending_budget" | "active" | "closed";

/**
 * pending  — submitted, views tracking, waiting for the brand's review
 * approved — passed review, views still tracking until the window ends
 * rejected — with a reason; terminal
 * settled  — views verified, payout fixed, voucher signed; claimable
 * paid     — the voucher was redeemed onchain; terminal
 */
export type SubmissionStatus = "pending" | "approved" | "rejected" | "settled" | "paid";

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "In review",
  approved: "Approved · tracking",
  rejected: "Rejected",
  settled: "Claimable",
  paid: "Paid",
};

export type Campaign = {
  id: string;
  brand: `0x${string}`;
  brandName: string;
  title: string;
  type: CampaignType;
  category: Category;
  platforms: Platform[];
  /** CLIPR (wei) per 1,000 views. */
  ratePerMille: string;
  /** CLIPR (wei) deposited for clippers, net of fee. */
  budget: string;
  /** CLIPR (wei) settled so far (vouchers signed, paid or not). */
  spent: string;
  /** A submission below this (wei) is not paid. */
  minPayout: string;
  /** Cap per submission (wei). */
  maxPayout: string;
  /** Optional flat bonus (wei) on every approved submission. */
  flatBonus: string;
  description: string;
  requirements: string[];
  assetsUrl: string | null;
  status: CampaignStatus;
  /** Escrow campaign id once funded onchain; null in preview. */
  escrowId: number | null;
  fundTx: string | null;
  createdAt: number;
  endsAt: number;
  closedAt: number | null;
  /** Seeded example, not a real brand. */
  sample: boolean;
};

export type Submission = {
  id: string;
  campaignId: string;
  clipper: `0x${string}`;
  platform: Platform;
  url: string;
  postId: string;
  status: SubmissionStatus;
  views: number;
  viewsSource: "youtube-api" | "manual" | null;
  viewsAt: number | null;
  /** Fixed at settlement (wei). "0" before. */
  payout: string;
  reason: string | null;
  voucher: Voucher | null;
  paidTx: string | null;
  submittedAt: number;
  reviewedAt: number | null;
  settledAt: number | null;
  sample: boolean;
};

export type Voucher = {
  campaignId: number;
  /** keccak256 of the submission id, as the contract sees it. */
  submissionId: `0x${string}`;
  clipper: `0x${string}`;
  amount: string;
  deadline: number;
  signature: `0x${string}`;
};

/** A submission as the public sees it — no wallet beyond a short form. */
export type PublicSubmission = Pick<
  Submission,
  "id" | "platform" | "url" | "status" | "views" | "payout" | "submittedAt"
> & { clipperShort: string };

// ────────────────────────────── arithmetic ──────────────────────────────

const ONE = 10n ** 18n;

export const toWei = (whole: string | number): bigint => {
  const s = String(whole).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`not a number: ${whole}`);
  const [int, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(int) * ONE + BigInt(fracPadded);
};

/** Wei → whole tokens as a number, for arithmetic that tolerates float. */
export const fromWei = (wei: string | bigint): number => Number(BigInt(wei)) / 1e18;

/**
 * What a submission has earned: views / 1000 × rate, plus the flat bonus,
 * capped by the campaign's max payout. Integer maths on wei, rounded down
 * to the wei — nobody gets paid a fraction of a view.
 */
export function earnedFor(
  campaign: Pick<Campaign, "ratePerMille" | "maxPayout" | "flatBonus">,
  views: number,
): bigint {
  const safeViews = Number.isFinite(views) && views > 0 ? Math.floor(views) : 0;
  const fromViews = (BigInt(safeViews) * BigInt(campaign.ratePerMille)) / 1000n;
  const total = fromViews + BigInt(campaign.flatBonus);
  const cap = BigInt(campaign.maxPayout);
  return cap > 0n && total > cap ? cap : total;
}

export function remainingBudget(campaign: Pick<Campaign, "budget" | "spent">): bigint {
  const r = BigInt(campaign.budget) - BigInt(campaign.spent);
  return r > 0n ? r : 0n;
}

/** Views a campaign's remaining budget can still pay for at its rate. */
export function viewsLeft(campaign: Pick<Campaign, "budget" | "spent" | "ratePerMille">): number {
  const rate = BigInt(campaign.ratePerMille);
  if (rate === 0n) return 0;
  return Number((remainingBudget(campaign) * 1000n) / rate);
}

export const trackingEndsAt = (submittedAt: number, trackingDays: number) =>
  submittedAt + trackingDays * 24 * 60 * 60 * 1000;

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Campaign fields a brief hash is computed over — the on-chain tie-in. */
export function briefPayload(c: Pick<Campaign, "title" | "ratePerMille" | "minPayout" | "maxPayout" | "flatBonus" | "platforms" | "requirements" | "endsAt">) {
  return JSON.stringify({
    title: c.title,
    ratePerMille: c.ratePerMille,
    minPayout: c.minPayout,
    maxPayout: c.maxPayout,
    flatBonus: c.flatBonus,
    platforms: [...c.platforms].sort(),
    requirements: c.requirements,
    endsAt: c.endsAt,
  });
}
