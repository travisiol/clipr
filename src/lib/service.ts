import "server-only";
import { randomBytes } from "node:crypto";
import { isAddress, getAddress } from "viem";
import {
  committedOn,
  findSubmissionByUrl,
  getCampaign,
  getSubmission,
  insertCampaign,
  insertSubmission,
  listSubmissions,
  updateCampaign,
  updateSubmission,
} from "@/lib/db";
import {
  CAMPAIGN_TYPES,
  CATEGORIES,
  PLATFORMS,
  earnedFor,
  remainingBudget,
  toWei,
  trackingEndsAt,
  type Campaign,
  type CampaignType,
  type Category,
  type Platform,
  type Submission,
} from "@/lib/model";
import { parsePostUrl } from "@/lib/platforms";
import { economics } from "@/lib/site";
import { isLive } from "@/lib/contracts";
import { signVoucher, submissionKey } from "@/lib/voucher";
import { trackViews } from "@/lib/views";
import { confirmFunding, confirmSettlement } from "@/lib/chainReads";
import type { Session } from "@/lib/auth";

/**
 * The rules of the marketplace in one place. Route handlers parse and
 * authenticate; everything that decides what is allowed lives here so the
 * same rule cannot drift between two endpoints.
 */

export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const newId = () => randomBytes(6).toString("hex");
const DAY = 24 * 60 * 60 * 1000;

// ─────────────────────────────── campaigns ─────────────────────────────

export type CampaignInput = {
  brandName: string;
  title: string;
  type: CampaignType;
  category: Category;
  platforms: Platform[];
  /** Whole tokens as typed: "2.5". */
  ratePerMille: string;
  budget: string;
  minPayout: string;
  maxPayout: string;
  flatBonus: string;
  description: string;
  requirements: string[];
  assetsUrl: string | null;
  /** Days from now. */
  durationDays: number;
};

const str = (v: unknown, max: number, name: string, min = 1): string => {
  if (typeof v !== "string") throw new ServiceError(`${name} is required.`);
  const s = v.trim();
  if (s.length < min) throw new ServiceError(`${name} is required.`);
  if (s.length > max) throw new ServiceError(`${name} is too long (max ${max} characters).`);
  return s;
};

const amount = (v: unknown, name: string, opts: { allowZero?: boolean } = {}): bigint => {
  if (typeof v !== "string" && typeof v !== "number") throw new ServiceError(`${name} is required.`);
  let wei: bigint;
  try {
    wei = toWei(v);
  } catch {
    throw new ServiceError(`${name} must be a number.`);
  }
  if (wei === 0n && !opts.allowZero) throw new ServiceError(`${name} must be above zero.`);
  return wei;
};

export function parseCampaignInput(body: unknown): CampaignInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const type = b.type;
  if (!CAMPAIGN_TYPES.includes(type as CampaignType)) throw new ServiceError("Pick a campaign type.");
  const category = b.category;
  if (!CATEGORIES.includes(category as Category)) throw new ServiceError("Pick a category.");
  const platforms = Array.isArray(b.platforms) ? (b.platforms as unknown[]) : [];
  const cleanPlatforms = [...new Set(platforms)].filter((p): p is Platform => PLATFORMS.includes(p as Platform));
  if (cleanPlatforms.length === 0) throw new ServiceError("Pick at least one platform.");
  const requirements = (Array.isArray(b.requirements) ? (b.requirements as unknown[]) : [])
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 12);
  const durationDays = Number(b.durationDays);
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 180) {
    throw new ServiceError("Duration must be between 1 and 180 days.");
  }
  let assetsUrl: string | null = null;
  if (typeof b.assetsUrl === "string" && b.assetsUrl.trim()) {
    try {
      const u = new URL(b.assetsUrl.trim());
      if (u.protocol !== "https:") throw new Error();
      assetsUrl = u.toString();
    } catch {
      throw new ServiceError("Assets link must be an https:// URL.");
    }
  }
  const rate = amount(b.ratePerMille, "Rate per 1,000 views");
  const budget = amount(b.budget, "Budget");
  const minPayout = amount(b.minPayout, "Minimum payout", { allowZero: true });
  const maxPayout = amount(b.maxPayout, "Maximum payout", { allowZero: true });
  const flatBonus = amount(b.flatBonus ?? "0", "Flat bonus", { allowZero: true });
  if (maxPayout > 0n && minPayout > maxPayout) throw new ServiceError("Minimum payout is above the maximum.");
  if (maxPayout > budget) throw new ServiceError("Maximum payout per clip is above the whole budget.");
  if (rate > budget) throw new ServiceError("The rate per 1,000 views is above the whole budget.");
  if (flatBonus > budget) throw new ServiceError("The flat bonus is above the whole budget.");

  return {
    brandName: str(b.brandName, 60, "Brand name"),
    title: str(b.title, 120, "Title"),
    type: type as CampaignType,
    category: category as Category,
    platforms: cleanPlatforms,
    ratePerMille: String(b.ratePerMille),
    budget: String(b.budget),
    minPayout: String(b.minPayout ?? "0"),
    maxPayout: String(b.maxPayout ?? "0"),
    flatBonus: String(b.flatBonus ?? "0"),
    description: str(b.description, 2000, "Description", 20),
    requirements,
    assetsUrl,
    durationDays,
  };
}

export function createCampaign(session: Session, input: CampaignInput): Campaign {
  const now = Date.now();
  const campaign: Campaign = {
    id: newId(),
    brand: session.address,
    brandName: input.brandName,
    title: input.title,
    type: input.type,
    category: input.category,
    platforms: input.platforms,
    ratePerMille: toWei(input.ratePerMille).toString(),
    budget: toWei(input.budget).toString(),
    spent: "0",
    minPayout: toWei(input.minPayout).toString(),
    maxPayout: toWei(input.maxPayout).toString(),
    flatBonus: toWei(input.flatBonus).toString(),
    description: input.description,
    requirements: input.requirements,
    assetsUrl: input.assetsUrl,
    // Live: nothing is listed until the deposit is confirmed. Preview: there
    // is no escrow to wait for, so the campaign lists at once, flagged.
    status: isLive ? "pending_budget" : "active",
    escrowId: null,
    fundTx: null,
    createdAt: now,
    endsAt: now + input.durationDays * DAY,
    closedAt: null,
    sample: false,
  };
  insertCampaign(campaign);
  return campaign;
}

export async function fundCampaign(session: Session, campaignId: string, txHash: string): Promise<Campaign> {
  const c = mustCampaign(campaignId);
  if (c.brand.toLowerCase() !== session.address.toLowerCase()) throw new ServiceError("Not your campaign.", 403);
  if (c.status !== "pending_budget") throw new ServiceError("This campaign is not waiting for a deposit.");
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new ServiceError("That is not a transaction hash.");
  const result = await confirmFunding(txHash as `0x${string}`, { brand: c.brand, budget: BigInt(c.budget) });
  if (!result.ok) throw new ServiceError(result.reason);
  updateCampaign(c.id, { status: "active", escrowId: result.escrowId, fundTx: txHash });
  return getCampaign(c.id)!;
}

/** Preview only: list a campaign without a deposit. Refused when live. */
export function activatePreview(session: Session, campaignId: string): Campaign {
  if (isLive) throw new ServiceError("Live mode — campaigns activate by depositing, not by hand.", 403);
  if (!session.ops) throw new ServiceError("Ops only.", 403);
  const c = mustCampaign(campaignId);
  if (c.status !== "pending_budget") throw new ServiceError("Not pending.");
  updateCampaign(c.id, { status: "active" });
  return getCampaign(c.id)!;
}

export function closeCampaign(session: Session, campaignId: string): Campaign {
  const c = mustCampaign(campaignId);
  const isBrand = c.brand.toLowerCase() === session.address.toLowerCase();
  if (!isBrand && !session.ops) throw new ServiceError("Only the brand can close its campaign.", 403);
  if (c.status === "closed") throw new ServiceError("Already closed.");
  updateCampaign(c.id, { status: "closed", closedAt: Date.now() });
  return getCampaign(c.id)!;
}

function mustCampaign(id: string): Campaign {
  const c = getCampaign(id);
  if (!c) throw new ServiceError("No such campaign.", 404);
  return c;
}

// ────────────────────────────── submissions ────────────────────────────

export function submitClip(session: Session, campaignId: string, rawUrl: unknown): Submission {
  const c = mustCampaign(campaignId);
  if (c.status !== "active") throw new ServiceError("This campaign is not taking submissions.");
  if (c.endsAt < Date.now()) throw new ServiceError("This campaign has ended.");
  if (c.brand.toLowerCase() === session.address.toLowerCase()) {
    throw new ServiceError("A brand cannot submit to its own campaign.");
  }
  if (remainingBudget(c) === 0n) throw new ServiceError("The budget is exhausted.");
  if (typeof rawUrl !== "string") throw new ServiceError("Paste the link to your post.");
  const parsed = parsePostUrl(rawUrl);
  if (!parsed.ok) throw new ServiceError(parsed.reason);
  if (!c.platforms.includes(parsed.post.platform)) {
    throw new ServiceError("This campaign does not accept posts from that platform.");
  }
  if (findSubmissionByUrl(c.id, parsed.post.canonicalUrl)) {
    throw new ServiceError("That post was already submitted to this campaign.");
  }
  const s: Submission = {
    id: newId(),
    campaignId: c.id,
    clipper: session.address,
    platform: parsed.post.platform,
    url: parsed.post.canonicalUrl,
    postId: parsed.post.postId,
    status: "pending",
    views: 0,
    viewsSource: null,
    viewsAt: null,
    payout: "0",
    reason: null,
    voucher: null,
    paidTx: null,
    submittedAt: Date.now(),
    reviewedAt: null,
    settledAt: null,
    sample: false,
  };
  insertSubmission(s);
  return s;
}

function mustSubmission(id: string): { s: Submission; c: Campaign } {
  const s = getSubmission(id);
  if (!s) throw new ServiceError("No such submission.", 404);
  return { s, c: mustCampaign(s.campaignId) };
}

const canReview = (session: Session, c: Campaign) =>
  session.ops || c.brand.toLowerCase() === session.address.toLowerCase();

export function reviewSubmission(
  session: Session,
  submissionId: string,
  decision: "approve" | "reject",
  reason: unknown,
): Submission {
  const { s, c } = mustSubmission(submissionId);
  if (!canReview(session, c)) throw new ServiceError("Only the brand or ops can review.", 403);
  if (s.status !== "pending" && !(s.status === "approved" && decision === "reject")) {
    throw new ServiceError(`Cannot ${decision} a submission that is ${s.status}.`);
  }
  if (decision === "reject") {
    const why = typeof reason === "string" ? reason.trim().slice(0, 300) : "";
    if (!why) throw new ServiceError("Give the clipper a reason.");
    updateSubmission(s.id, { status: "rejected", reason: why, reviewedAt: Date.now() });
  } else {
    updateSubmission(s.id, { status: "approved", reason: null, reviewedAt: Date.now() });
  }
  return getSubmission(s.id)!;
}

export function recordViews(session: Session, submissionId: string, rawViews: unknown): Submission {
  const { s, c } = mustSubmission(submissionId);
  if (!canReview(session, c)) throw new ServiceError("Only the brand or ops can record views.", 403);
  if (s.status === "settled" || s.status === "paid") throw new ServiceError("Views are frozen once settled.");
  const views = Number(rawViews);
  if (!Number.isInteger(views) || views < 0 || views > 1e10) throw new ServiceError("Views must be a whole number.");
  updateSubmission(s.id, { views, viewsSource: "manual", viewsAt: Date.now() });
  return getSubmission(s.id)!;
}

export async function refreshViews(session: Session, submissionId: string) {
  const { s, c } = mustSubmission(submissionId);
  const mine = s.clipper.toLowerCase() === session.address.toLowerCase();
  if (!mine && !canReview(session, c)) throw new ServiceError("Not yours.", 403);
  if (s.status === "settled" || s.status === "paid") throw new ServiceError("Views are frozen once settled.");
  const result = await trackViews(s.platform, s.postId);
  if (result.ok) {
    updateSubmission(s.id, { views: result.views, viewsSource: result.source, viewsAt: Date.now() });
  }
  return { result, submission: getSubmission(s.id)! };
}

/**
 * Fix the payout and, when the escrow is live, sign the voucher. The
 * tracking window must be over unless ops decides to settle early (a brand
 * closing a campaign, say). Budget is reserved as vouchers are signed, so
 * two settlements can never promise the same CLIPR.
 */
export async function settleSubmission(session: Session, submissionId: string, opts: { early?: boolean } = {}) {
  if (!session.ops) throw new ServiceError("Ops only — settlement signs money.", 403);
  const { s, c } = mustSubmission(submissionId);
  if (s.status !== "approved") throw new ServiceError("Only approved submissions settle.");
  const windowEnd = trackingEndsAt(s.submittedAt, economics.trackingDays);
  if (Date.now() < windowEnd && !opts.early) {
    throw new ServiceError("Tracking window still running — settle early only on purpose.");
  }
  if (s.views <= 0 || s.viewsAt === null) throw new ServiceError("Record the verified view count first.");

  const earned = earnedFor(c, s.views);
  if (earned < BigInt(c.minPayout)) {
    updateSubmission(s.id, {
      status: "rejected",
      reason: `Below the campaign's minimum payout after the tracking window.`,
      reviewedAt: Date.now(),
    });
    return getSubmission(s.id)!;
  }
  const free = remainingBudget(c) - committedOn(c.id);
  const payout = earned > free ? free : earned;
  if (payout <= 0n) throw new ServiceError("The budget is fully committed — nothing left to settle.");

  const voucher =
    c.escrowId !== null
      ? await signVoucher({ escrowCampaignId: c.escrowId, submissionId: s.id, clipper: s.clipper, amount: payout })
      : null;

  updateSubmission(s.id, { status: "settled", payout: payout.toString(), voucher, settledAt: Date.now() });
  updateCampaign(c.id, { spent: (BigInt(c.spent) + payout).toString() });
  return getSubmission(s.id)!;
}

export async function markPaid(session: Session, submissionId: string, txHash: unknown): Promise<Submission> {
  const { s } = mustSubmission(submissionId);
  const mine = s.clipper.toLowerCase() === session.address.toLowerCase();
  if (!mine && !session.ops) throw new ServiceError("Not yours.", 403);
  if (s.status !== "settled") throw new ServiceError("Nothing to redeem.");
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new ServiceError("That is not a transaction hash.");
  }
  const result = await confirmSettlement(txHash as `0x${string}`, { submissionKey: submissionKey(s.id) });
  if (!result.ok) throw new ServiceError(result.reason);
  updateSubmission(s.id, { status: "paid", paidTx: txHash });
  return getSubmission(s.id)!;
}

// ───────────────────────────────── reads ───────────────────────────────

/** What a signed-in clipper has earned across everything. */
export function earningsFor(address: string) {
  const subs = listSubmissions({ clipper: address });
  let claimable = 0n;
  let paid = 0n;
  let tracking = 0n;
  for (const s of subs) {
    if (s.status === "settled") claimable += BigInt(s.payout);
    else if (s.status === "paid") paid += BigInt(s.payout);
    else if (s.status === "approved" || s.status === "pending") {
      const c = getCampaign(s.campaignId);
      if (c) tracking += earnedFor(c, s.views);
    }
  }
  return { submissions: subs, claimable, paid, tracking };
}

export const isValidAddress = (a: unknown): a is `0x${string}` => typeof a === "string" && isAddress(a);
export const normalizeAddress = (a: string) => getAddress(a);
