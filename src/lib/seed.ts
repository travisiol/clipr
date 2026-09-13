import { createHash } from "node:crypto";
import { earnedFor, toWei, type Campaign, type Submission } from "@/lib/model";

/**
 * Sample campaigns, seeded into an empty database so the marketplace is not
 * a blank grid on day one. Every brand and every clipper here is invented —
 * listing real companies or real creators in a demo would suggest they are
 * involved — and every record carries `sample: true`, which the UI turns
 * into a visible "Sample" chip. Nothing in here is escrowed.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A deterministic, obviously fake wallet from a label. */
const fakeAddress = (label: string): `0x${string}` =>
  `0x${createHash("sha256").update(`clipr-sample:${label}`).digest("hex").slice(0, 40)}`;

const id = (label: string) => createHash("sha256").update(`clipr-id:${label}`).digest("hex").slice(0, 12);

type Draft = Omit<Campaign, "id" | "brand" | "spent" | "status" | "escrowId" | "fundTx" | "closedAt" | "sample" | "createdAt" | "endsAt"> & {
  key: string;
  ageDays: number;
  lengthDays: number;
};

const drafts: Draft[] = [
  {
    key: "nightshift",
    brandName: "Nightshift Records",
    title: "Nightshift — clip the 'Low Tide' sessions",
    type: "clipping",
    category: "Music",
    platforms: ["tiktok", "instagram", "youtube"],
    ratePerMille: toWei("2.5").toString(),
    budget: toWei("25000").toString(),
    minPayout: toWei("10").toString(),
    maxPayout: toWei("1500").toString(),
    flatBonus: "0",
    description:
      "Three live sessions, ninety minutes each, filmed in the studio. Cut the moments that work as 15–45s vertical clips: a vocal take, a look between the band, the bass drop at 41:10 of session two. Music must stay unpitched and unsped.",
    requirements: [
      "Vertical 9:16, 15 to 45 seconds",
      "Caption must credit @nightshift.records and tag #lowtide",
      "No speed-up, no pitch shift, no AI voice-over",
      "One submission per post; reposts of another clipper's edit are rejected",
    ],
    assetsUrl: "https://drive.google.com/drive/folders/sample-nightshift",
    ageDays: 9,
    lengthDays: 30,
  },
  {
    key: "deadline",
    brandName: "Deadline Podcast",
    title: "Deadline Podcast — best moments, episodes 40–52",
    type: "clipping",
    category: "Podcast",
    platforms: ["tiktok", "youtube", "x"],
    ratePerMille: toWei("1.75").toString(),
    budget: toWei("12000").toString(),
    minPayout: toWei("5").toString(),
    maxPayout: toWei("800").toString(),
    flatBonus: "0",
    description:
      "Two-hour interviews with founders who shipped under pressure. We want the punchlines and the hard admissions, subtitled, with the guest's name on screen for the first three seconds.",
    requirements: [
      "Burned-in subtitles",
      "Guest name on screen in the first 3 seconds",
      "Link to the full episode in the caption or comments",
      "Do not cut mid-sentence to change the meaning",
    ],
    assetsUrl: "https://drive.google.com/drive/folders/sample-deadline",
    ageDays: 14,
    lengthDays: 45,
  },
  {
    key: "orbital",
    brandName: "Orbital Gaming",
    title: "Orbital Gaming — stream highlights, any game",
    type: "clipping",
    category: "Streaming",
    platforms: ["tiktok", "instagram", "youtube"],
    ratePerMille: toWei("1.2").toString(),
    budget: toWei("8000").toString(),
    minPayout: toWei("5").toString(),
    maxPayout: toWei("400").toString(),
    flatBonus: "0",
    description:
      "Daily 6-hour streams. Rage, clutch plays, chat moments — anything that holds for 20 seconds. Use the VOD links in the assets folder; live captures are fine if the stream overlay is visible.",
    requirements: [
      "Stream overlay must stay visible (no cropping the handle out)",
      "Tag #orbitalclips",
      "Nothing from the paid-members-only VODs",
    ],
    assetsUrl: "https://drive.google.com/drive/folders/sample-orbital",
    ageDays: 5,
    lengthDays: 21,
  },
  {
    key: "kettle",
    brandName: "Kettle Finance",
    title: "Kettle — UGC: show your first onchain yield",
    type: "ugc",
    category: "Crypto",
    platforms: ["tiktok", "instagram", "x"],
    ratePerMille: toWei("4").toString(),
    budget: toWei("40000").toString(),
    minPayout: toWei("20").toString(),
    maxPayout: toWei("2500").toString(),
    flatBonus: toWei("15").toString(),
    description:
      "Original talking-head or screen-recorded content: you deposit, you show the first yield landing, you say what you'd do with it. Honest tone, no price predictions, no 'guaranteed'. Every approved post also earns a 15 CLIPR flat bonus.",
    requirements: [
      "Original footage — no clipping of our own videos",
      "Must show the app on screen for at least 5 seconds",
      "No returns figures, no 'guaranteed', no financial advice",
      "Disclose the partnership (#ad or 'paid partnership')",
    ],
    assetsUrl: "https://drive.google.com/drive/folders/sample-kettle",
    ageDays: 3,
    lengthDays: 60,
  },
  {
    key: "marrow",
    brandName: "Studio Marrow",
    title: "Studio Marrow — behind-the-scenes cuts, 'Ash' short film",
    type: "clipping",
    category: "Brand",
    platforms: ["instagram", "youtube"],
    ratePerMille: toWei("3").toString(),
    budget: toWei("6000").toString(),
    minPayout: toWei("10").toString(),
    maxPayout: toWei("600").toString(),
    flatBonus: "0",
    description:
      "Forty minutes of raw behind-the-scenes from the 'Ash' shoot: lighting setups, the practical rain rig, the director walking actors through the alley scene. Cinematic, slow, no memes.",
    requirements: [
      "No meme captions, no trending audio — use the original sound",
      "Credit the director and DP in the caption (names in the assets folder)",
      "Colour must not be regraded",
    ],
    assetsUrl: "https://drive.google.com/drive/folders/sample-marrow",
    ageDays: 20,
    lengthDays: 40,
  },
  {
    key: "loop",
    brandName: "Loop Fitness",
    title: "Loop Fitness — 30-day challenge clips",
    type: "clipping",
    category: "Sports",
    platforms: ["tiktok", "instagram"],
    ratePerMille: toWei("0.9").toString(),
    budget: toWei("5000").toString(),
    minPayout: toWei("5").toString(),
    maxPayout: toWei("300").toString(),
    flatBonus: "0",
    description:
      "Thirty daily workout videos, 20 minutes each. Cut the single hardest move of the day into a 10–20s clip with the day number on screen. Volume game: many small clips, not one long one.",
    requirements: [
      "Day number on screen",
      "Tag #loop30",
      "No nudity-adjacent crops, keep the full frame",
    ],
    assetsUrl: "https://drive.google.com/drive/folders/sample-loop",
    ageDays: 2,
    lengthDays: 30,
  },
  {
    key: "pantry",
    brandName: "Pixel Pantry",
    title: "Pixel Pantry — cooking stream fails & wins",
    type: "clipping",
    category: "Streaming",
    platforms: ["tiktok", "youtube", "x"],
    ratePerMille: toWei("1.5").toString(),
    budget: toWei("9000").toString(),
    minPayout: toWei("5").toString(),
    maxPayout: toWei("500").toString(),
    flatBonus: "0",
    description:
      "A cooking streamer who cannot cook. Fires, collapses, the one time the soufflé rose. Subtitles welcome, sound effects welcome, keep the chat overlay.",
    requirements: [
      "Keep the chat overlay",
      "Tag #pixelpantry",
      "No content from before March (old branding)",
    ],
    assetsUrl: "https://drive.google.com/drive/folders/sample-pantry",
    ageDays: 11,
    lengthDays: 30,
  },
  {
    key: "crossfade",
    brandName: "Crossfade FM",
    title: "Crossfade FM — DJ set moments, summer series",
    type: "clipping",
    category: "Music",
    platforms: ["tiktok", "instagram", "youtube", "x"],
    ratePerMille: toWei("2").toString(),
    budget: toWei("15000").toString(),
    minPayout: toWei("10").toString(),
    maxPayout: toWei("1000").toString(),
    flatBonus: "0",
    description:
      "Twelve rooftop sets, sunrise to noon. The drops, the crowd, the sky changing. Audio stays original; sped-up versions are rejected because the tracks are licensed.",
    requirements: [
      "Original audio only — no speed-ups, no remixes",
      "Tag #crossfadefm and the DJ's handle (list in assets)",
      "Vertical only",
    ],
    assetsUrl: "https://drive.google.com/drive/folders/sample-crossfade",
    ageDays: 27,
    lengthDays: 30,
  },
];

const clipperNames = [
  "mara.cuts",
  "vertical_vince",
  "clipsbyjo",
  "noor.edits",
  "hexframe",
  "teo.reels",
  "sasha.loops",
  "ren_cutroom",
  "lulu.shorts",
  "kmontage",
  "pixelpetra",
  "yusuf.edits",
];

type SubDraft = {
  campaign: string;
  clipper: string;
  platform: Submission["platform"];
  views: number;
  status: Submission["status"];
  ageDays: number;
  reason?: string;
};

const subDrafts: SubDraft[] = [
  { campaign: "nightshift", clipper: "mara.cuts", platform: "tiktok", views: 412_000, status: "paid", ageDays: 8.5 },
  { campaign: "nightshift", clipper: "vertical_vince", platform: "instagram", views: 188_400, status: "paid", ageDays: 8 },
  { campaign: "nightshift", clipper: "noor.edits", platform: "youtube", views: 96_200, status: "settled", ageDays: 7.5 },
  { campaign: "nightshift", clipper: "hexframe", platform: "tiktok", views: 1_280_000, status: "approved", ageDays: 4 },
  { campaign: "nightshift", clipper: "teo.reels", platform: "tiktok", views: 22_900, status: "pending", ageDays: 1.2 },
  { campaign: "nightshift", clipper: "sasha.loops", platform: "instagram", views: 3_100, status: "rejected", ageDays: 6, reason: "Sped-up audio — the brief asks for the original tempo." },
  { campaign: "deadline", clipper: "clipsbyjo", platform: "youtube", views: 640_000, status: "paid", ageDays: 12 },
  { campaign: "deadline", clipper: "ren_cutroom", platform: "tiktok", views: 310_500, status: "paid", ageDays: 11 },
  { campaign: "deadline", clipper: "kmontage", platform: "x", views: 74_800, status: "settled", ageDays: 9 },
  { campaign: "deadline", clipper: "lulu.shorts", platform: "tiktok", views: 158_000, status: "approved", ageDays: 3 },
  { campaign: "deadline", clipper: "yusuf.edits", platform: "youtube", views: 9_400, status: "pending", ageDays: 0.6 },
  { campaign: "orbital", clipper: "hexframe", platform: "tiktok", views: 402_000, status: "settled", ageDays: 4.5 },
  { campaign: "orbital", clipper: "pixelpetra", platform: "youtube", views: 275_000, status: "approved", ageDays: 2.5 },
  { campaign: "orbital", clipper: "teo.reels", platform: "instagram", views: 41_000, status: "pending", ageDays: 0.9 },
  { campaign: "kettle", clipper: "noor.edits", platform: "tiktok", views: 306_000, status: "settled", ageDays: 2.8 },
  { campaign: "kettle", clipper: "mara.cuts", platform: "x", views: 88_000, status: "approved", ageDays: 2 },
  { campaign: "kettle", clipper: "sasha.loops", platform: "instagram", views: 12_500, status: "pending", ageDays: 0.4 },
  { campaign: "kettle", clipper: "kmontage", platform: "tiktok", views: 51_000, status: "rejected", ageDays: 1.5, reason: "Contains a returns figure ('12% a month') — the brief forbids numbers." },
  { campaign: "marrow", clipper: "vertical_vince", platform: "instagram", views: 520_000, status: "paid", ageDays: 18 },
  { campaign: "marrow", clipper: "lulu.shorts", platform: "youtube", views: 190_000, status: "paid", ageDays: 16 },
  { campaign: "marrow", clipper: "ren_cutroom", platform: "instagram", views: 27_000, status: "approved", ageDays: 5 },
  { campaign: "pantry", clipper: "pixelpetra", platform: "tiktok", views: 1_100_000, status: "paid", ageDays: 10 },
  { campaign: "pantry", clipper: "clipsbyjo", platform: "youtube", views: 340_000, status: "settled", ageDays: 8 },
  { campaign: "pantry", clipper: "yusuf.edits", platform: "x", views: 66_000, status: "approved", ageDays: 3.5 },
  { campaign: "pantry", clipper: "teo.reels", platform: "tiktok", views: 15_800, status: "pending", ageDays: 1.1 },
  { campaign: "crossfade", clipper: "mara.cuts", platform: "tiktok", views: 2_050_000, status: "paid", ageDays: 25 },
  { campaign: "crossfade", clipper: "hexframe", platform: "instagram", views: 980_000, status: "paid", ageDays: 24 },
  { campaign: "crossfade", clipper: "noor.edits", platform: "youtube", views: 730_000, status: "paid", ageDays: 22 },
  { campaign: "crossfade", clipper: "sasha.loops", platform: "x", views: 410_000, status: "paid", ageDays: 20 },
  { campaign: "crossfade", clipper: "kmontage", platform: "tiktok", views: 1_540_000, status: "settled", ageDays: 12 },
  { campaign: "crossfade", clipper: "lulu.shorts", platform: "tiktok", views: 64_000, status: "approved", ageDays: 4 },
];

const samplePostUrl = (platform: Submission["platform"], clipper: string, n: number) => {
  const handle = clipper.replace(/\./g, "_");
  const num = String(7_100_000_000_000_000_000n + BigInt(n) * 9_137n);
  switch (platform) {
    case "tiktok":
      return { url: `https://www.tiktok.com/@${handle}/video/${num}`, postId: num };
    case "instagram": {
      const pid = `C${(n * 7919).toString(36).toUpperCase().padStart(9, "A").slice(0, 10)}`;
      return { url: `https://www.instagram.com/reel/${pid}/`, postId: pid };
    }
    case "youtube": {
      const pid = `s${(n * 104729).toString(36)}Q7xL`.slice(0, 11);
      return { url: `https://www.youtube.com/shorts/${pid}`, postId: pid };
    }
    case "x":
      return { url: `https://x.com/${handle}/status/${num}`, postId: num };
  }
};

export function buildSamples(now = Date.now()): { campaigns: Campaign[]; submissions: Submission[] } {
  const campaigns: Campaign[] = drafts.map((d) => ({
    id: id(`campaign:${d.key}`),
    brand: fakeAddress(`brand:${d.key}`),
    brandName: d.brandName,
    title: d.title,
    type: d.type,
    category: d.category,
    platforms: d.platforms,
    ratePerMille: d.ratePerMille,
    budget: d.budget,
    spent: "0",
    minPayout: d.minPayout,
    maxPayout: d.maxPayout,
    flatBonus: d.flatBonus,
    description: d.description,
    requirements: d.requirements,
    assetsUrl: d.assetsUrl,
    status: "active",
    escrowId: null,
    fundTx: null,
    createdAt: now - d.ageDays * DAY,
    endsAt: now + (d.lengthDays - d.ageDays) * DAY,
    closedAt: null,
    sample: true,
  }));
  const byKey = new Map(drafts.map((d, i) => [d.key, campaigns[i]]));

  const submissions: Submission[] = subDrafts.map((s, n) => {
    const campaign = byKey.get(s.campaign)!;
    const { url, postId } = samplePostUrl(s.platform, s.clipper, n + 1);
    const submittedAt = now - s.ageDays * DAY;
    const settled = s.status === "settled" || s.status === "paid";
    const payout = settled ? earnedFor(campaign, s.views) : 0n;
    if (settled) campaign.spent = (BigInt(campaign.spent) + payout).toString();
    const reviewed = s.status !== "pending";
    return {
      id: id(`submission:${s.campaign}:${s.clipper}:${n}`),
      campaignId: campaign.id,
      clipper: fakeAddress(`clipper:${s.clipper}`),
      platform: s.platform,
      url,
      postId,
      status: s.status,
      views: s.views,
      viewsSource: "manual",
      viewsAt: now - Math.min(s.ageDays, 0.3) * DAY,
      payout: payout.toString(),
      reason: s.reason ?? null,
      voucher: null,
      paidTx: null,
      submittedAt,
      reviewedAt: reviewed ? submittedAt + 0.4 * DAY : null,
      settledAt: settled ? submittedAt + 7 * DAY : null,
      sample: true,
    };
  });

  return { campaigns, submissions };
}

/** Called by `db()` right after the schema is created. */
export function seedIfEmpty(io: {
  countCampaigns: () => number;
  insertCampaign: (c: Campaign) => void;
  insertSubmission: (s: Submission) => void;
}): void {
  if (process.env.CLIPR_SKIP_SEED === "true") return;
  if (io.countCampaigns() > 0) return;
  const { campaigns, submissions } = buildSamples();
  for (const c of campaigns) io.insertCampaign(c);
  for (const s of submissions) io.insertSubmission(s);
}

/** Exposed for the ops screen: which sample names exist, for the "who is this" hover. */
export const sampleClipperNames = clipperNames;
