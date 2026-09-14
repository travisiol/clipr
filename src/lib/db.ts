import "server-only";
import { DatabaseSync } from "node:sqlite";
import type { Campaign, Submission, Voucher } from "@/lib/model";
import { seedIfEmpty } from "@/lib/seed";
import { pickDbPath, type DbPlacement } from "@/lib/dbPath";

/**
 * One SQLite file, opened once per process. `node:sqlite` ships with Node
 * 22.13+ / 24, so there is nothing to build and nothing to configure: the
 * schema is created on first open and the sample data seeded if the file is
 * new. Where the file goes is decided in `dbPath.ts` — on a read-only host
 * (Vercel) it lands in /tmp and `storageInfo()` says so.
 *
 * Amounts are wei as TEXT (SQLite integers stop at 2^63; 18 decimals do not).
 */

declare global {
  // Survives Next's dev-time module reloads, which would otherwise open a
  // fresh handle per reload.
  var __cliprDb: DatabaseSync | undefined;
  var __cliprDbPlacement: DbPlacement | undefined;
}

/** Where the database is and whether it will survive a restart. */
export function storageInfo(): DbPlacement {
  if (!globalThis.__cliprDbPlacement) {
    const placement = pickDbPath();
    if (placement.ephemeral) {
      console.warn(
        `[clipr] ${placement.reason} — using ${placement.path}. This storage is ephemeral: ` +
          `the database resets on every cold start and is not shared between instances. ` +
          `Set CLIPR_DB_PATH to a persistent disk, or move to a hosted database, before taking real submissions.`,
      );
    }
    globalThis.__cliprDbPlacement = placement;
  }
  return globalThis.__cliprDbPlacement;
}

function open(): DatabaseSync {
  const db = new DatabaseSync(storageInfo().path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id            TEXT PRIMARY KEY,
      brand         TEXT NOT NULL,
      brand_name    TEXT NOT NULL,
      title         TEXT NOT NULL,
      type          TEXT NOT NULL,
      category      TEXT NOT NULL,
      platforms     TEXT NOT NULL,
      rate_per_mille TEXT NOT NULL,
      budget        TEXT NOT NULL,
      spent         TEXT NOT NULL DEFAULT '0',
      min_payout    TEXT NOT NULL DEFAULT '0',
      max_payout    TEXT NOT NULL DEFAULT '0',
      flat_bonus    TEXT NOT NULL DEFAULT '0',
      description   TEXT NOT NULL DEFAULT '',
      requirements  TEXT NOT NULL DEFAULT '[]',
      assets_url    TEXT,
      status        TEXT NOT NULL,
      escrow_id     INTEGER,
      fund_tx       TEXT,
      created_at    INTEGER NOT NULL,
      ends_at       INTEGER NOT NULL,
      closed_at     INTEGER,
      sample        INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS campaigns_brand ON campaigns(brand);
    CREATE INDEX IF NOT EXISTS campaigns_status ON campaigns(status, created_at);

    CREATE TABLE IF NOT EXISTS submissions (
      id            TEXT PRIMARY KEY,
      campaign_id   TEXT NOT NULL REFERENCES campaigns(id),
      clipper       TEXT NOT NULL,
      platform      TEXT NOT NULL,
      url           TEXT NOT NULL,
      post_id       TEXT NOT NULL,
      status        TEXT NOT NULL,
      views         INTEGER NOT NULL DEFAULT 0,
      views_source  TEXT,
      views_at      INTEGER,
      payout        TEXT NOT NULL DEFAULT '0',
      reason        TEXT,
      voucher       TEXT,
      paid_tx       TEXT,
      submitted_at  INTEGER NOT NULL,
      reviewed_at   INTEGER,
      settled_at    INTEGER,
      sample        INTEGER NOT NULL DEFAULT 0,
      UNIQUE (campaign_id, url)
    );
    CREATE INDEX IF NOT EXISTS submissions_campaign ON submissions(campaign_id, status);
    CREATE INDEX IF NOT EXISTS submissions_clipper ON submissions(clipper, submitted_at);

    CREATE TABLE IF NOT EXISTS nonces (
      nonce      TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
  `);
  return db;
}

export function db(): DatabaseSync {
  if (!globalThis.__cliprDb) {
    const handle = open();
    globalThis.__cliprDb = handle;
    seedIfEmpty({ insertCampaign, insertSubmission, countCampaigns: () => countCampaigns() });
  }
  return globalThis.__cliprDb;
}

// ─────────────────────────────── mapping ───────────────────────────────

type CampaignRow = {
  id: string;
  brand: string;
  brand_name: string;
  title: string;
  type: string;
  category: string;
  platforms: string;
  rate_per_mille: string;
  budget: string;
  spent: string;
  min_payout: string;
  max_payout: string;
  flat_bonus: string;
  description: string;
  requirements: string;
  assets_url: string | null;
  status: string;
  escrow_id: number | null;
  fund_tx: string | null;
  created_at: number;
  ends_at: number;
  closed_at: number | null;
  sample: number;
};

type SubmissionRow = {
  id: string;
  campaign_id: string;
  clipper: string;
  platform: string;
  url: string;
  post_id: string;
  status: string;
  views: number;
  views_source: string | null;
  views_at: number | null;
  payout: string;
  reason: string | null;
  voucher: string | null;
  paid_tx: string | null;
  submitted_at: number;
  reviewed_at: number | null;
  settled_at: number | null;
  sample: number;
};

const campaignFromRow = (r: CampaignRow): Campaign => ({
  id: r.id,
  brand: r.brand as `0x${string}`,
  brandName: r.brand_name,
  title: r.title,
  type: r.type as Campaign["type"],
  category: r.category as Campaign["category"],
  platforms: JSON.parse(r.platforms),
  ratePerMille: r.rate_per_mille,
  budget: r.budget,
  spent: r.spent,
  minPayout: r.min_payout,
  maxPayout: r.max_payout,
  flatBonus: r.flat_bonus,
  description: r.description,
  requirements: JSON.parse(r.requirements),
  assetsUrl: r.assets_url,
  status: r.status as Campaign["status"],
  escrowId: r.escrow_id,
  fundTx: r.fund_tx,
  createdAt: r.created_at,
  endsAt: r.ends_at,
  closedAt: r.closed_at,
  sample: r.sample === 1,
});

const submissionFromRow = (r: SubmissionRow): Submission => ({
  id: r.id,
  campaignId: r.campaign_id,
  clipper: r.clipper as `0x${string}`,
  platform: r.platform as Submission["platform"],
  url: r.url,
  postId: r.post_id,
  status: r.status as Submission["status"],
  views: r.views,
  viewsSource: r.views_source as Submission["viewsSource"],
  viewsAt: r.views_at,
  payout: r.payout,
  reason: r.reason,
  voucher: r.voucher ? (JSON.parse(r.voucher) as Voucher) : null,
  paidTx: r.paid_tx,
  submittedAt: r.submitted_at,
  reviewedAt: r.reviewed_at,
  settledAt: r.settled_at,
  sample: r.sample === 1,
});

// ─────────────────────────────── campaigns ─────────────────────────────

export function insertCampaign(c: Campaign): void {
  db()
    .prepare(
      `INSERT INTO campaigns (id, brand, brand_name, title, type, category, platforms, rate_per_mille,
         budget, spent, min_payout, max_payout, flat_bonus, description, requirements, assets_url,
         status, escrow_id, fund_tx, created_at, ends_at, closed_at, sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      c.id,
      c.brand.toLowerCase(),
      c.brandName,
      c.title,
      c.type,
      c.category,
      JSON.stringify(c.platforms),
      c.ratePerMille,
      c.budget,
      c.spent,
      c.minPayout,
      c.maxPayout,
      c.flatBonus,
      c.description,
      JSON.stringify(c.requirements),
      c.assetsUrl,
      c.status,
      c.escrowId,
      c.fundTx,
      c.createdAt,
      c.endsAt,
      c.closedAt,
      c.sample ? 1 : 0,
    );
}

export function countCampaigns(): number {
  const row = globalThis.__cliprDb!.prepare("SELECT COUNT(*) AS n FROM campaigns").get() as { n: number };
  return row.n;
}

export function getCampaign(id: string): Campaign | null {
  const row = db().prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as CampaignRow | undefined;
  return row ? campaignFromRow(row) : null;
}

export function listCampaigns(opts: { brand?: string; includePending?: boolean } = {}): Campaign[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.brand) {
    where.push("brand = ?");
    args.push(opts.brand.toLowerCase());
  } else if (!opts.includePending) {
    where.push("status != 'pending_budget'");
  }
  const sql = `SELECT * FROM campaigns ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
  return (db().prepare(sql).all(...args) as CampaignRow[]).map(campaignFromRow);
}

export function updateCampaign(
  id: string,
  patch: Partial<Pick<Campaign, "status" | "spent" | "escrowId" | "fundTx" | "closedAt" | "budget">>,
): void {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const put = (col: string, v: string | number | null) => {
    sets.push(`${col} = ?`);
    args.push(v);
  };
  if (patch.status !== undefined) put("status", patch.status);
  if (patch.spent !== undefined) put("spent", patch.spent);
  if (patch.budget !== undefined) put("budget", patch.budget);
  if (patch.escrowId !== undefined) put("escrow_id", patch.escrowId);
  if (patch.fundTx !== undefined) put("fund_tx", patch.fundTx);
  if (patch.closedAt !== undefined) put("closed_at", patch.closedAt);
  if (!sets.length) return;
  args.push(id);
  db()
    .prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ?`)
    .run(...args);
}

// ────────────────────────────── submissions ────────────────────────────

export function insertSubmission(s: Submission): void {
  db()
    .prepare(
      `INSERT INTO submissions (id, campaign_id, clipper, platform, url, post_id, status, views, views_source,
         views_at, payout, reason, voucher, paid_tx, submitted_at, reviewed_at, settled_at, sample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      s.id,
      s.campaignId,
      s.clipper.toLowerCase(),
      s.platform,
      s.url,
      s.postId,
      s.status,
      s.views,
      s.viewsSource,
      s.viewsAt,
      s.payout,
      s.reason,
      s.voucher ? JSON.stringify(s.voucher) : null,
      s.paidTx,
      s.submittedAt,
      s.reviewedAt,
      s.settledAt,
      s.sample ? 1 : 0,
    );
}

export function getSubmission(id: string): Submission | null {
  const row = db().prepare("SELECT * FROM submissions WHERE id = ?").get(id) as SubmissionRow | undefined;
  return row ? submissionFromRow(row) : null;
}

export function findSubmissionByUrl(campaignId: string, url: string): Submission | null {
  const row = db()
    .prepare("SELECT * FROM submissions WHERE campaign_id = ? AND url = ?")
    .get(campaignId, url) as SubmissionRow | undefined;
  return row ? submissionFromRow(row) : null;
}

export function listSubmissions(opts: { campaignId?: string; clipper?: string; status?: string[] }): Submission[] {
  const where: string[] = [];
  const args: string[] = [];
  if (opts.campaignId) {
    where.push("campaign_id = ?");
    args.push(opts.campaignId);
  }
  if (opts.clipper) {
    where.push("clipper = ?");
    args.push(opts.clipper.toLowerCase());
  }
  if (opts.status?.length) {
    where.push(`status IN (${opts.status.map(() => "?").join(",")})`);
    args.push(...opts.status);
  }
  const sql = `SELECT * FROM submissions ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY submitted_at DESC`;
  return (db().prepare(sql).all(...args) as SubmissionRow[]).map(submissionFromRow);
}

export function updateSubmission(
  id: string,
  patch: Partial<
    Pick<
      Submission,
      "status" | "views" | "viewsSource" | "viewsAt" | "payout" | "reason" | "voucher" | "paidTx" | "reviewedAt" | "settledAt"
    >
  >,
): void {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const put = (col: string, v: string | number | null) => {
    sets.push(`${col} = ?`);
    args.push(v);
  };
  if (patch.status !== undefined) put("status", patch.status);
  if (patch.views !== undefined) put("views", patch.views);
  if (patch.viewsSource !== undefined) put("views_source", patch.viewsSource);
  if (patch.viewsAt !== undefined) put("views_at", patch.viewsAt);
  if (patch.payout !== undefined) put("payout", patch.payout);
  if (patch.reason !== undefined) put("reason", patch.reason);
  if (patch.voucher !== undefined) put("voucher", patch.voucher ? JSON.stringify(patch.voucher) : null);
  if (patch.paidTx !== undefined) put("paid_tx", patch.paidTx);
  if (patch.reviewedAt !== undefined) put("reviewed_at", patch.reviewedAt);
  if (patch.settledAt !== undefined) put("settled_at", patch.settledAt);
  if (!sets.length) return;
  args.push(id);
  db()
    .prepare(`UPDATE submissions SET ${sets.join(", ")} WHERE id = ?`)
    .run(...args);
}

/** Wei already promised on a campaign by vouchers not yet redeemed. */
export function committedOn(campaignId: string): bigint {
  const rows = db()
    .prepare("SELECT payout FROM submissions WHERE campaign_id = ? AND status = 'settled'")
    .all(campaignId) as { payout: string }[];
  return rows.reduce((acc, r) => acc + BigInt(r.payout), 0n);
}

// ───────────────────────────────── stats ───────────────────────────────

export function stats() {
  const d = db();
  const campaigns = d
    .prepare("SELECT COUNT(*) AS n FROM campaigns WHERE status = 'active'")
    .get() as { n: number };
  const budgets = d.prepare("SELECT budget, spent FROM campaigns WHERE status != 'pending_budget'").all() as {
    budget: string;
    spent: string;
  }[];
  const escrowed = budgets.reduce((acc, r) => acc + (BigInt(r.budget) - BigInt(r.spent)), 0n);
  const paid = (
    d.prepare("SELECT payout FROM submissions WHERE status IN ('settled','paid')").all() as { payout: string }[]
  ).reduce((acc, r) => acc + BigInt(r.payout), 0n);
  const clippers = d.prepare("SELECT COUNT(DISTINCT clipper) AS n FROM submissions").get() as { n: number };
  const views = d.prepare("SELECT COALESCE(SUM(views),0) AS n FROM submissions WHERE status != 'rejected'").get() as {
    n: number;
  };
  const samples = d.prepare("SELECT COUNT(*) AS n FROM campaigns WHERE sample = 1").get() as { n: number };
  return {
    activeCampaigns: campaigns.n,
    escrowed: escrowed.toString(),
    paid: paid.toString(),
    clippers: clippers.n,
    views: views.n,
    hasSamples: samples.n > 0,
  };
}

// ───────────────────────────────── nonces ──────────────────────────────

export function putNonce(nonce: string, ttlMs: number): void {
  const d = db();
  d.prepare("DELETE FROM nonces WHERE expires_at < ?").run(Date.now());
  d.prepare("INSERT INTO nonces (nonce, expires_at) VALUES (?, ?)").run(nonce, Date.now() + ttlMs);
}

/** Consume a nonce: true once, false ever after. */
export function takeNonce(nonce: string): boolean {
  const d = db();
  const row = d.prepare("SELECT expires_at FROM nonces WHERE nonce = ?").get(nonce) as
    | { expires_at: number }
    | undefined;
  if (!row) return false;
  d.prepare("DELETE FROM nonces WHERE nonce = ?").run(nonce);
  return row.expires_at >= Date.now();
}
