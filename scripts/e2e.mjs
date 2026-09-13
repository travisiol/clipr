/**
 * End-to-end walk of the marketplace against a running dev server, with two
 * throwaway wallets: a brand posts a campaign, a clipper submits, the brand
 * reviews, ops settles, the clipper sees the payout. Every step asserts.
 *
 *   node scripts/e2e.mjs [http://localhost:3720]
 *
 * Preview mode is assumed (no escrow): the campaign lists at once and the
 * settlement fixes a payout without a voucher.
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");

const BASE = process.argv[2] ?? "http://localhost:3720";

function signInMessage(address, nonce, issuedAt) {
  return [
    "CLIPR wants you to sign in with your wallet.",
    "",
    "This request will not trigger a transaction or cost any gas.",
    "",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt}`,
  ].join("\n");
}

class Client {
  constructor(name) {
    this.name = name;
    this.account = privateKeyToAccount(generatePrivateKey());
    this.cookie = "";
  }
  async call(path, init = {}) {
    const res = await fetch(BASE + path, {
      ...init,
      headers: { ...(init.body ? { "content-type": "application/json" } : {}), cookie: this.cookie, ...(init.headers ?? {}) },
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body };
  }
  async signIn() {
    const { body: n } = await this.call("/api/auth/nonce");
    const message = signInMessage(this.account.address, n.nonce, n.issuedAt);
    const signature = await this.account.signMessage({ message });
    const r = await this.call("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ address: this.account.address, nonce: n.nonce, issuedAt: n.issuedAt, signature }),
    });
    assert.equal(r.status, 200, `${this.name} sign-in: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.session.address, this.account.address);
    console.log(`✓ ${this.name} signed in as ${this.account.address} (ops=${r.body.session.ops})`);
    return r.body.session;
  }
}

const brand = new Client("brand");
const clipper = new Client("clipper");
const stranger = new Client("stranger");

// ── unauthenticated ─────────────────────────────────────────────────────
{
  const r = await brand.call("/api/campaigns", { method: "POST", body: JSON.stringify({}) });
  assert.equal(r.status, 401);
  console.log("✓ creating a campaign without a session is refused (401)");
}

// ── forged sign-in ──────────────────────────────────────────────────────
{
  const { body: n } = await stranger.call("/api/auth/nonce");
  const message = signInMessage(brand.account.address, n.nonce, n.issuedAt);
  const signature = await stranger.account.signMessage({ message }); // wrong key
  const r = await stranger.call("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({ address: brand.account.address, nonce: n.nonce, issuedAt: n.issuedAt, signature }),
  });
  assert.equal(r.status, 401);
  console.log(`✓ a signature from the wrong key is refused: ${r.body.error}`);
  // The nonce was consumed by the failed attempt: replaying it fails too.
  const again = await stranger.call("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({ address: brand.account.address, nonce: n.nonce, issuedAt: n.issuedAt, signature }),
  });
  assert.equal(again.status, 401);
  assert.match(again.body.error, /Nonce/);
  console.log("✓ a nonce is single-use");
}

const brandSession = await brand.signIn();
await clipper.signIn();

// ── validation ──────────────────────────────────────────────────────────
{
  const bad = await brand.call("/api/campaigns", {
    method: "POST",
    body: JSON.stringify({ brandName: "X", title: "Bad", type: "clipping", category: "Music", platforms: ["tiktok"], ratePerMille: "5000", budget: "100", minPayout: "0", maxPayout: "0", description: "a description long enough to pass", requirements: [], durationDays: 10 }),
  });
  assert.equal(bad.status, 400);
  console.log(`✓ a rate above the budget is refused: ${bad.body.error}`);
}

// ── create ──────────────────────────────────────────────────────────────
const created = await brand.call("/api/campaigns", {
  method: "POST",
  body: JSON.stringify({
    brandName: "E2E Records",
    title: "E2E — clip the test session",
    type: "clipping",
    category: "Music",
    platforms: ["tiktok", "youtube"],
    ratePerMille: "2.5",
    budget: "1000",
    minPayout: "10",
    maxPayout: "100",
    flatBonus: "0",
    description: "An end-to-end test campaign. Cut anything from the test session into vertical clips.",
    requirements: ["Vertical", "Tag #e2e"],
    assetsUrl: "https://example.com/assets",
    durationDays: 14,
  }),
});
assert.equal(created.status, 201, JSON.stringify(created.body));
const campaign = created.body.campaign;
assert.equal(campaign.status, "active", "preview: lists at once");
assert.equal(campaign.ratePerMille, "2500000000000000000");
assert.equal(campaign.budget, "1000000000000000000000");
console.log(`✓ campaign ${campaign.id} created, active, not escrowed`);

// It is listed publicly.
{
  const r = await stranger.call("/api/campaigns");
  assert.ok(r.body.campaigns.some((c) => c.id === campaign.id));
  console.log("✓ listed on /api/campaigns");
}

// ── submit ──────────────────────────────────────────────────────────────
const submit = (client, url) =>
  client.call(`/api/campaigns/${campaign.id}/submissions`, { method: "POST", body: JSON.stringify({ url }) });

{
  const own = await submit(brand, "https://www.tiktok.com/@brand/video/7300000000000000001");
  assert.equal(own.status, 400);
  assert.match(own.body.error, /own campaign/);
  console.log("✓ the brand cannot submit to its own campaign");

  const ig = await submit(clipper, "https://www.instagram.com/reel/Cabc123/");
  assert.equal(ig.status, 400);
  assert.match(ig.body.error, /platform/);
  console.log("✓ a platform the campaign does not accept is refused");

  const short = await submit(clipper, "https://vm.tiktok.com/ZMabc/");
  assert.equal(short.status, 400);
  console.log(`✓ short links are refused with guidance: ${short.body.error}`);
}

const sub = await submit(clipper, "https://www.tiktok.com/@clipper/video/7300000000000000002?is_from_webapp=1");
assert.equal(sub.status, 201, JSON.stringify(sub.body));
const submission = sub.body.submission;
assert.equal(submission.status, "pending");
assert.equal(submission.url, "https://www.tiktok.com/@clipper/video/7300000000000000002", "canonicalised");
console.log(`✓ submission ${submission.id} pending`);

{
  const dup = await submit(clipper, "https://www.tiktok.com/@clipper/video/7300000000000000002");
  assert.equal(dup.status, 400);
  assert.match(dup.body.error, /already submitted/);
  console.log("✓ duplicates are refused");
}

// ── review ──────────────────────────────────────────────────────────────
const patch = (client, id, body) => client.call(`/api/submissions/${id}`, { method: "PATCH", body: JSON.stringify(body) });

{
  const r = await patch(stranger, submission.id, { action: "approve" });
  assert.equal(r.status, 401);
  console.log("✓ reviewing without a session is refused");

  const noReason = await patch(brand, submission.id, { action: "reject", reason: "" });
  assert.equal(noReason.status, 400);
  console.log("✓ a rejection needs a reason");

  const early = await patch(brand, submission.id, { action: "settle" });
  assert.equal(early.status, brandSession.ops ? 400 : 403);
  console.log(`✓ settling a pending submission is refused: ${early.body.error}`);
}

{
  const r = await patch(brand, submission.id, { action: "views", views: 30_000 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.submission.views, 30_000);
  assert.equal(r.body.submission.viewsSource, "manual");
  console.log("✓ brand recorded 30,000 views by hand");
}

{
  const r = await patch(brand, submission.id, { action: "approve" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.submission.status, "approved");
  console.log("✓ brand approved");
}

// ── settle (ops; in preview with OPS_ADDRESSES unset, any wallet) ───────
{
  const tooSoon = await patch(clipper, submission.id, { action: "settle" });
  assert.equal(tooSoon.status, 400);
  assert.match(tooSoon.body.error, /window/);
  console.log("✓ settling inside the tracking window needs `early`");

  const r = await patch(clipper, submission.id, { action: "settle", early: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const s = r.body.submission;
  assert.equal(s.status, "settled");
  // 30,000 views × 2.5 / 1000 = 75 CLIPR, under the 100 cap, over the 10 minimum.
  assert.equal(s.payout, "75000000000000000000");
  assert.equal(s.voucher, null, "no escrow → no voucher");
  console.log("✓ settled: payout fixed at 75 CLIPR, voucher pending (preview)");

  const again = await patch(clipper, submission.id, { action: "settle", early: true });
  assert.equal(again.status, 400);
  console.log("✓ a settled submission cannot settle twice");
}

// ── the clipper's view ──────────────────────────────────────────────────
{
  const r = await clipper.call("/api/me");
  assert.equal(r.status, 200);
  assert.equal(r.body.earnings.claimable, "75000000000000000000");
  assert.ok(r.body.submissions.some((s) => s.id === submission.id && s.status === "settled"));
  console.log("✓ /api/me shows 75 CLIPR claimable");

  const c = await stranger.call(`/api/campaigns/${campaign.id}`);
  assert.equal(c.body.campaign.spent, "75000000000000000000");
  assert.equal(c.body.leaderboard[0].views, 30_000);
  assert.equal(c.body.submissions, undefined, "strangers do not see the full queue");
  console.log("✓ campaign spent = 75 CLIPR, leaderboard public, queue private");
}

// ── cap and minimum ─────────────────────────────────────────────────────
{
  const big = await submit(clipper, "https://www.youtube.com/shorts/e2eBigClip01");
  assert.equal(big.status, 201);
  await patch(brand, big.body.submission.id, { action: "views", views: 5_000_000 });
  await patch(brand, big.body.submission.id, { action: "approve" });
  const r = await patch(clipper, big.body.submission.id, { action: "settle", early: true });
  assert.equal(r.body.submission.payout, "100000000000000000000", "capped at max payout");
  console.log("✓ a 5M-view clip is capped at 100 CLIPR");

  const tiny = await submit(clipper, "https://www.youtube.com/shorts/e2eTinyClip1");
  await patch(brand, tiny.body.submission.id, { action: "views", views: 1_000 });
  await patch(brand, tiny.body.submission.id, { action: "approve" });
  const t = await patch(clipper, tiny.body.submission.id, { action: "settle", early: true });
  assert.equal(t.body.submission.status, "rejected");
  assert.match(t.body.submission.reason, /minimum/);
  console.log("✓ a 1,000-view clip (2.5 CLIPR) falls under the 10 CLIPR minimum and is rejected");
}

// ── close ───────────────────────────────────────────────────────────────
{
  const r = await stranger.call(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify({ action: "close" }) });
  assert.equal(r.status, 401);
  await stranger.signIn();
  const r2 = await stranger.call(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify({ action: "close" }) });
  // Stranger is ops in preview (OPS_ADDRESSES unset) — ops may close; otherwise 403.
  assert.ok([200, 403].includes(r2.status));
  const r3 = await brand.call(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify({ action: "close" }) });
  assert.ok([200, 400].includes(r3.status));
  const c = await brand.call(`/api/campaigns/${campaign.id}`);
  assert.equal(c.body.campaign.status, "closed");
  const late = await submit(clipper, "https://www.tiktok.com/@clipper/video/7300000000000000009");
  assert.equal(late.status, 400);
  console.log("✓ closed: no more submissions");
}

// ── sign out ────────────────────────────────────────────────────────────
{
  await clipper.call("/api/auth/logout", { method: "POST" });
  const r = await clipper.call("/api/me");
  assert.equal(r.status, 401);
  console.log("✓ signed out");
}

console.log("\nAll good.");
