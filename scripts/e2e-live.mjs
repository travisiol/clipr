/**
 * The live path, end to end, against a local Hardhat node and a dev server
 * started in live mode (see README → "Trying the live path locally"):
 *
 *   brand deposits on chain → server confirms the receipt and lists
 *   → clipper submits → brand reviews → ops settles → server signs a voucher
 *   → clipper redeems it on chain → server confirms and marks it paid.
 *
 *   node scripts/e2e-live.mjs [http://localhost:3720]
 *
 * Uses the well-known Hardhat accounts: #0 deployer/token holder, #1 the
 * voucher signer (SETTLEMENT_SIGNER_KEY on the server), #2 brand, #3 clipper.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { privateKeyToAccount } = require("viem/accounts");
const { createPublicClient, createWalletClient, http, keccak256, toBytes, parseEther, defineChain } = require("viem");

const BASE = process.argv[2] ?? "http://localhost:3720";
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const TOKEN = process.env.NEXT_PUBLIC_CLIPR_TOKEN_ADDRESS;
const ESCROW = process.env.NEXT_PUBLIC_CLIPR_ESCROW_ADDRESS;
assert.ok(TOKEN && ESCROW, "set NEXT_PUBLIC_CLIPR_TOKEN_ADDRESS and NEXT_PUBLIC_CLIPR_ESCROW_ADDRESS");

const artifact = (name) => JSON.parse(readFileSync(new URL(`../contracts/artifacts/contracts/${name}.sol/${name}.json`, import.meta.url), "utf8")).abi;
const escrowAbi = artifact("ClipEscrow");
const tokenAbi = artifact("ClipToken");

const chain = defineChain({ id: 31337, name: "Hardhat", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = (key) => {
  const account = privateKeyToAccount(key);
  return { account, client: createWalletClient({ account, chain, transport: http(RPC) }) };
};
const deployer = wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const brandW = wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const clipperW = wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");

const signInMessage = (address, nonce, issuedAt) =>
  ["CLIPR wants you to sign in with your wallet.", "", "This request will not trigger a transaction or cost any gas.", "", `Address: ${address}`, `Nonce: ${nonce}`, `Issued at: ${issuedAt}`].join("\n");

class Session {
  constructor(name, account) {
    this.name = name;
    this.account = account;
    this.cookie = "";
  }
  async call(path, init = {}) {
    const res = await fetch(BASE + path, { ...init, headers: { ...(init.body ? { "content-type": "application/json" } : {}), cookie: this.cookie } });
    const sc = res.headers.get("set-cookie");
    if (sc) this.cookie = sc.split(";")[0];
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body };
  }
  async signIn() {
    const { body: n } = await this.call("/api/auth/nonce");
    const signature = await this.account.signMessage({ message: signInMessage(this.account.address, n.nonce, n.issuedAt) });
    const r = await this.call("/api/auth/verify", { method: "POST", body: JSON.stringify({ address: this.account.address, nonce: n.nonce, issuedAt: n.issuedAt, signature }) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    console.log(`✓ ${this.name} signed in (ops=${r.body.session.ops})`);
    return r.body.session;
  }
}

const brand = new Session("brand", brandW.account);
const clipper = new Session("clipper", clipperW.account);
const ops = new Session("ops", privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"));

const tx = async (w, req) => {
  const hash = await w.client.writeContract(req);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
  return hash;
};

// ── the brand needs CLIPR ────────────────────────────────────────────────
await tx(deployer, { address: TOKEN, abi: tokenAbi, functionName: "transfer", args: [brandW.account.address, parseEther("5000")] });
console.log("✓ brand funded with 5,000 CLIPR from the deployer");

await brand.signIn();
await clipper.signIn();
const opsSession = await ops.signIn();
assert.equal(opsSession.ops, true, "account #1 must be in OPS_ADDRESSES");

// ── create: live → pending budget, not listed ───────────────────────────
const created = await brand.call("/api/campaigns", {
  method: "POST",
  body: JSON.stringify({
    brandName: "Live Records",
    title: "Live — escrowed test campaign",
    type: "clipping",
    category: "Music",
    platforms: ["tiktok"],
    ratePerMille: "2",
    budget: "1000",
    minPayout: "1",
    maxPayout: "500",
    flatBonus: "0",
    description: "A live-mode test campaign whose budget is really deposited in the escrow.",
    requirements: ["Vertical"],
    assetsUrl: null,
    durationDays: 14,
  }),
});
assert.equal(created.status, 201, JSON.stringify(created.body));
const campaign = created.body.campaign;
assert.equal(campaign.status, "pending_budget");
{
  const pub404 = await clipper.call(`/api/campaigns/${campaign.id}`);
  assert.equal(pub404.status, 404, "pending campaigns are invisible to others");
  const list = await clipper.call("/api/campaigns");
  assert.ok(!list.body.campaigns.some((c) => c.id === campaign.id));
  console.log("✓ campaign pending budget, hidden from the public");
}

// ── a fake funding claim is refused ─────────────────────────────────────
{
  const r = await brand.call(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify({ action: "fund", txHash: "0x" + "11".repeat(32) }) });
  assert.notEqual(r.status, 200);
  console.log("✓ a made-up transaction hash does not activate the campaign");
}

// ── deposit, the way FundButton does ────────────────────────────────────
const budget = BigInt(campaign.budget);
const fee = (budget * 500n) / 10_000n;
await tx(brandW, { address: TOKEN, abi: tokenAbi, functionName: "approve", args: [ESCROW, budget + fee] });
const briefPayload = JSON.stringify({
  title: campaign.title,
  ratePerMille: campaign.ratePerMille,
  minPayout: campaign.minPayout,
  maxPayout: campaign.maxPayout,
  flatBonus: campaign.flatBonus,
  platforms: [...campaign.platforms].sort(),
  requirements: campaign.requirements,
  endsAt: campaign.endsAt,
});
const fundHash = await tx(brandW, {
  address: ESCROW,
  abi: escrowAbi,
  functionName: "createCampaign",
  args: [budget, BigInt(Math.floor(campaign.endsAt / 1000)), keccak256(toBytes(briefPayload))],
});
console.log(`✓ deposited ${budget / 10n ** 18n} + ${fee / 10n ** 18n} fee on chain (${fundHash.slice(0, 10)}…)`);

// The clipper cannot claim the brand's deposit as their own campaign's.
{
  const other = await clipper.call("/api/campaigns", {
    method: "POST",
    body: JSON.stringify({ brandName: "Impostor", title: "Someone else's deposit", type: "clipping", category: "Music", platforms: ["tiktok"], ratePerMille: "2", budget: "1000", minPayout: "1", maxPayout: "500", flatBonus: "0", description: "Trying to attach a deposit that is not mine to this campaign.", requirements: [], assetsUrl: null, durationDays: 14 }),
  });
  const r = await clipper.call(`/api/campaigns/${other.body.campaign.id}`, { method: "PATCH", body: JSON.stringify({ action: "fund", txHash: fundHash }) });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /different wallet/);
  console.log("✓ a deposit from another wallet cannot be attached to your campaign");
}

{
  const r = await brand.call(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify({ action: "fund", txHash: fundHash }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.campaign.status, "active");
  assert.equal(typeof r.body.campaign.escrowId, "number");
  assert.equal(r.body.campaign.fundTx, fundHash);
  console.log(`✓ server read the receipt: campaign active, escrow id #${r.body.campaign.escrowId}`);
  const onchain = await pub.readContract({ address: ESCROW, abi: escrowAbi, functionName: "available", args: [BigInt(r.body.campaign.escrowId)] });
  assert.equal(onchain, budget);
  console.log("✓ escrow.available(id) == budget");
}
const escrowId = (await brand.call(`/api/campaigns/${campaign.id}`)).body.campaign.escrowId;

// ── submit → review → settle ────────────────────────────────────────────
const sub = await clipper.call(`/api/campaigns/${campaign.id}/submissions`, { method: "POST", body: JSON.stringify({ url: "https://www.tiktok.com/@live/video/7400000000000000001" }) });
assert.equal(sub.status, 201, JSON.stringify(sub.body));
const submissionId = sub.body.submission.id;
const patch = (s, id, body) => s.call(`/api/submissions/${id}`, { method: "PATCH", body: JSON.stringify(body) });
await patch(brand, submissionId, { action: "views", views: 120_000 });
await patch(brand, submissionId, { action: "approve" });
{
  const notOps = await patch(clipper, submissionId, { action: "settle", early: true });
  assert.equal(notOps.status, 403);
  console.log("✓ live: a non-ops wallet cannot settle");
}
const settled = await patch(ops, submissionId, { action: "settle", early: true });
assert.equal(settled.status, 200, JSON.stringify(settled.body));
const v = settled.body.submission.voucher;
assert.ok(v, "voucher signed");
assert.equal(settled.body.submission.payout, "240000000000000000000", "120,000 × 2 / 1000 = 240");
assert.equal(v.amount, "240000000000000000000");
assert.equal(v.campaignId, escrowId);
assert.equal(v.clipper.toLowerCase(), clipperW.account.address.toLowerCase());
console.log("✓ ops settled: 240 CLIPR, EIP-712 voucher signed by the server");

// ── the voucher works on chain, once ───────────────────────────────────
{
  const before = await pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: "balanceOf", args: [clipperW.account.address] });
  const hash = await tx(clipperW, {
    address: ESCROW,
    abi: escrowAbi,
    functionName: "settle",
    args: [BigInt(v.campaignId), v.submissionId, v.clipper, BigInt(v.amount), BigInt(v.deadline), v.signature],
  });
  const after = await pub.readContract({ address: TOKEN, abi: tokenAbi, functionName: "balanceOf", args: [clipperW.account.address] });
  assert.equal(after - before, 240n * 10n ** 18n);
  console.log(`✓ clipper redeemed the voucher on chain: +240 CLIPR in the wallet (${hash.slice(0, 10)}…)`);

  const replay = pub.simulateContract({
    address: ESCROW,
    abi: escrowAbi,
    functionName: "settle",
    args: [BigInt(v.campaignId), v.submissionId, v.clipper, BigInt(v.amount), BigInt(v.deadline), v.signature],
    account: clipperW.account,
  });
  await assert.rejects(replay, /already settled/);
  console.log("✓ the same voucher is refused a second time");

  const wrongTx = await patch(clipper, submissionId, { action: "paid", txHash: fundHash });
  assert.equal(wrongTx.status, 400);
  console.log("✓ reporting an unrelated transaction as the claim is refused");

  const paid = await patch(clipper, submissionId, { action: "paid", txHash: hash });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.submission.status, "paid");
  assert.equal(paid.body.submission.paidTx, hash);
  console.log("✓ server read the Settled event: submission is paid");

  const me = await clipper.call("/api/me");
  assert.equal(me.body.earnings.paid, "240000000000000000000");
  assert.equal(me.body.earnings.claimable, "0");
  const c = await clipper.call(`/api/campaigns/${campaign.id}`);
  assert.equal(c.body.campaign.spent, "240000000000000000000");
  const avail = await pub.readContract({ address: ESCROW, abi: escrowAbi, functionName: "available", args: [BigInt(escrowId)] });
  assert.equal(avail, budget - 240n * 10n ** 18n);
  console.log("✓ dashboard, campaign and escrow all agree: 240 paid, 760 left");
}

console.log("\nLive path: all good.");
