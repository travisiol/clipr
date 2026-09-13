# CLIPR

**Clip. Post. Get paid per 1,000 views — in CLIPR.**

A clipping marketplace with the mechanics of Whop Content Rewards and one
change: every campaign budget is deposited, escrowed and paid out in the
platform's own token. Brands fund a campaign in CLIPR and set a rate per
thousand views; anyone clips, posts, submits the link, and — once the brand
approves and the views are verified — claims CLIPR from an escrow contract
into their wallet.

> **Status: preview.** The escrow contract is written and tested (21 tests)
> and the whole live path has been exercised against a local chain, but
> nothing is deployed and the token has not launched. `CLIPR` is a
> placeholder name. Until `NEXT_PUBLIC_CLIPR_LIVE=true` and both contract
> addresses are set, every screen says "preview" / "awaiting launch",
> campaigns list without escrow and payouts cannot be claimed.

## What is real, what is not

| Thing | State |
| --- | --- |
| Wallet sign-in (nonce + `personal_sign`, HMAC session cookie) | Real. Single-use nonces, ERC-1271 smart wallets not supported. |
| Campaigns, submissions, review, view counts, settlement maths | Real, in SQLite (`node:sqlite`, no native build). |
| Post-link recognition (TikTok / Reels / Shorts / X) and de-duplication | Real. Short TikTok links are refused on purpose. |
| Automated view tracking | **YouTube only**, with `YOUTUBE_API_KEY`. TikTok, Instagram and X have no usable API: ops reads the count on the post and records it as "manual". |
| Escrow contract `ClipEscrow` | Written, tested, **not deployed**. |
| Vouchers (EIP-712, signed by the server) | Real when live: signed with `SETTLEMENT_SIGNER_KEY`, verified by the contract. In preview the payout is fixed and the dashboard shows "voucher pending". |
| Deposit / claim confirmations | Real when live: the server reads the transaction receipt (`CampaignCreated` / `Settled` events) before changing state. |
| The 8 campaigns and 31 submissions you see on a fresh database | **Seeded samples**, invented brands and clippers, flagged `Sample` in the UI. `CLIPR_SKIP_SEED=true` starts empty. |
| The token's price, venue, supply | Not decided. Nothing on the site invents a price. |

## The economics, as built

- **Rate and budget are in CLIPR**, fixed at campaign creation. No dollar
  peg: if the price moves, the dollar value of a campaign moves with it. The
  FAQ says so.
- **Platform fee: 5 %** (`feeBps = 500`, cap 10 %), charged **on top** of the
  budget at every deposit and forwarded at once to `feeRecipient`. The whole
  budget figure on a card is available to clippers. Whether the recipient is
  a treasury or a burn address is a deployment decision — one constructor
  argument.
- **Payout per clip** = `views / 1000 × rate + flatBonus`, capped by the
  campaign's max payout, refused under its min payout, never past the budget
  (the server reserves budget as it signs vouchers; the contract enforces it
  again).
- **Tracking window: 7 days** per submission (`NEXT_PUBLIC_CLIPR_TRACKING_DAYS`).
  Ops settles when it closes, or earlier on purpose.
- **Closing a campaign** stops submissions; vouchers keep settling for the
  contract's 7-day grace period; then the brand — and only the brand — can
  withdraw the remainder. Vouchers are valid 7 days, so none can outlive the
  grace period.
- **No owner path to campaign funds.** The contract owner can rotate the
  signer and change the fee for future deposits. That is all.

## Who does what

| Role | How | Can |
| --- | --- | --- |
| Clipper | any wallet | submit to open campaigns, see earnings, redeem vouchers |
| Brand | the wallet that created the campaign | fund (live) / see the queue, approve, reject with a reason, record views, close |
| Ops | `OPS_ADDRESSES` (comma-separated). Unset in preview = every signed-in wallet | everything a brand can on every campaign, plus settle (sign vouchers) and, in preview, activate a campaign without a deposit |

The honest centralisation point is ops: the chain cannot read TikTok, so a
human verifies views and a server key signs what is owed. The contract then
enforces the part a website cannot fake — the budget exists, a clip is paid
once, nothing exceeds the budget.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000, preview mode, seeded
```

Node 24 (for `node:sqlite`). No `.env` needed for preview; copy
`.env.example` to `.env.local` to change anything.

```bash
npm run typecheck && npm run lint && npm run build
node scripts/e2e.mjs [http://localhost:3000]        # full preview walk, two throwaway wallets
```

## Contracts

```bash
cd contracts
npm install
npm test               # 21 tests
npm run export-abi     # → ../src/lib/abi/*.ts (typed, `as const`)
```

`ClipEscrow.sol` — campaigns, deposits with fee, EIP-712 settlement vouchers,
close / grace / withdraw. `ClipToken.sol` — a plain fixed-supply ERC-20, only
deployed if the coin is not launched elsewhere (the escrow takes any ERC-20).

### Trying the live path locally

```bash
# terminal 1
cd contracts && npx hardhat node

# terminal 2
cd contracts && SIGNER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  npx hardhat run scripts/deploy.ts --network localhost
# prints the two addresses

# terminal 3 — the web app in live mode against the local node
NEXT_PUBLIC_CLIPR_LIVE=true \
NEXT_PUBLIC_CLIPR_TOKEN_ADDRESS=<token> NEXT_PUBLIC_CLIPR_ESCROW_ADDRESS=<escrow> \
NEXT_PUBLIC_ROBINHOOD_CHAIN_ID=31337 NEXT_PUBLIC_ROBINHOOD_RPC_URL=http://127.0.0.1:8545 \
SETTLEMENT_SIGNER_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
OPS_ADDRESSES=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
CLIPR_DB_PATH=/tmp/clipr-live.db npx next dev --port 3721

# terminal 4
NEXT_PUBLIC_CLIPR_TOKEN_ADDRESS=<token> NEXT_PUBLIC_CLIPR_ESCROW_ADDRESS=<escrow> \
  node scripts/e2e-live.mjs http://localhost:3721
```

`e2e-live.mjs` deposits from a brand wallet, has the server confirm the
receipt, submits, reviews, settles (server signs the voucher), redeems the
voucher on chain from the clipper's wallet, proves it cannot be redeemed
twice, and checks that dashboard, campaign and escrow agree. It passed on
2026-09-12.

### Deploying for real

```bash
cd contracts
DEPLOYER_PRIVATE_KEY=… SIGNER_ADDRESS=… FEE_RECIPIENT=… FEE_BPS=500 \
  npm run deploy:robinhood
```

Then in the web app's env: the two addresses, `NEXT_PUBLIC_CLIPR_LIVE=true`,
`SETTLEMENT_SIGNER_KEY` (the signer's key — keep it off the web server in
production), `OPS_ADDRESSES`, `SESSION_SECRET`. `NEXT_PUBLIC_CLIPR_FEE_BPS`
must match what the escrow was deployed with. Verify the Robinhood Chain RPC
and explorer URLs in `src/lib/chain.ts` first — they were gathered from
third-party sources.

## Map

```
src/app/                 routes — /, /campaigns, /campaigns/[id], /launch, /dashboard, /ops, /token
src/app/api/             auth (nonce, verify, me, logout), campaigns, submissions, me, ops, stats
src/lib/site.ts          THE NAME, ticker, tagline, economics — rename here
src/lib/model.ts         types + payout arithmetic (shared client/server)
src/lib/service.ts       every rule of the marketplace, in one place
src/lib/db.ts            node:sqlite schema + queries; seeds src/lib/seed.ts on first open
src/lib/auth.ts          wallet sign-in, session cookie, ops list
src/lib/voucher.ts       EIP-712 settlement signing
src/lib/views.ts         view trackers (YouTube API; the rest is manual, and says so)
src/lib/chainReads.ts    receipt confirmation for deposits and claims
src/lib/platforms.ts     post-URL recognition
src/components/hero/     the three.js coin (no assets: the env map is painted at runtime)
contracts/               Hardhat 2 · solc 0.8.28 · OpenZeppelin 5 · 21 tests
scripts/                 e2e.mjs (preview), e2e-live.mjs (local chain)
```

## Open decisions

- The name. Everything user-visible resolves through `src/lib/site.ts`; the
  env prefix `NEXT_PUBLIC_CLIPR_*`, `package.json` and this file are the rest.
- Token launch: venue, supply, whether `ClipToken.sol` is used at all.
- Fee recipient: treasury or burn.
- Whether brands should get a USD reference price in the wizard
  (`NEXT_PUBLIC_CLIPR_USD`), and from where.
- Trackers for TikTok / Instagram / X (none exist that respect their terms).
- Who holds the signer key in production, and an audit.
- `clipr.xyz` / `@cliprxyz` are unregistered placeholders.
