import Link from "next/link";
import { Coin3D } from "@/components/hero/Coin3D";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { ButtonLink, Panel, Pill, SectionTitle, Stat } from "@/components/ui";
import { Faq } from "@/components/site/Faq";
import { listCampaigns, stats } from "@/lib/db";
import { fmtCompact, fmtToken } from "@/lib/format";
import { economics, site } from "@/lib/site";
import { isLive } from "@/lib/contracts";
import { now } from "@/lib/clock";

export default async function Home() {
  const s = stats();
  const at = now();
  const featured = listCampaigns()
    .filter((c) => c.status === "active")
    .sort((a, b) => Number(BigInt(b.budget) - BigInt(b.spent) - (BigInt(a.budget) - BigInt(a.spent))))
    .slice(0, 6);

  return (
    <>
      {/* ───────────────────────────── Hero ───────────────────────────── */}
      <section className="shell relative pt-10 pb-8 md:pt-16 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-7">
            <div className="rise flex flex-wrap items-center gap-2">
              <Pill tone="brand">
                <span className="dot-live" aria-hidden />
                {isLive ? "Live on Robinhood Chain" : "Preview · awaiting launch"}
              </Pill>
              <Pill>Clipping marketplace, paid in {site.ticker}</Pill>
            </div>
            <h1 className="display rise rise-2 text-[clamp(44px,7.2vw,96px)] text-hi">
              Clip. Post.
              <br />
              Get paid <span className="brand-text">per 1,000 views.</span>
            </h1>
            <p className="rise rise-3 max-w-[52ch] text-[17px] leading-relaxed text-mid md:text-[18px]">
              Brands deposit a budget in <strong className="text-hi">{site.ticker}</strong> and set a rate per thousand
              views. Anyone can clip, post, submit the link and get paid — straight from an onchain escrow into their
              wallet. No audience required, no invoices, no waiting on a payout run.
            </p>
            <div className="rise rise-3 flex flex-wrap items-center gap-3">
              <ButtonLink href="/campaigns" variant="primary" className="px-6">
                Find a campaign
              </ButtonLink>
              <ButtonLink href="/launch" variant="glass">
                Launch a campaign
              </ButtonLink>
              <Link href="#how" className="ml-1 text-[13.5px] font-medium text-mid hover:text-hi">
                How it works →
              </Link>
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[560px]">
            {/* CSS ground under the canvas: a coin-shaped glow, so the hero is
                never empty before three paints or when WebGL is missing. */}
            <div
              aria-hidden
              className="absolute inset-[18%] rounded-full opacity-90 blur-2xl"
              style={{ background: "radial-gradient(circle, rgba(255,140,80,.55), rgba(255,106,43,.18) 55%, transparent 72%)" }}
            />
            <Coin3D className="absolute inset-0" />
          </div>
        </div>

        {/* Stats strip */}
        <Panel className="mt-10 grid grid-cols-2 gap-6 px-6 py-5 md:grid-cols-4 md:px-8">
          <Stat label="Active campaigns" value={s.activeCampaigns} />
          <Stat label="In escrow" value={fmtToken(s.escrowed, { compact: true })} unit={site.ticker} tone="brand" />
          <Stat label="Paid to clippers" value={fmtToken(s.paid, { compact: true })} unit={site.ticker} />
          <Stat label="Views tracked" value={fmtCompact(s.views)} hint={s.hasSamples ? "includes sample campaigns" : undefined} />
        </Panel>
      </section>

      {/* ─────────────────────────── Marquee ──────────────────────────── */}
      <div className="relative my-10 overflow-hidden border-y border-[var(--line)] py-3">
        <div className="marquee text-[13px] font-semibold tracking-[0.12em] text-low uppercase">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex shrink-0 gap-12">
              {[
                "Budget escrowed onchain",
                "One payout per clip, enforced",
                `Every amount in ${site.ticker}`,
                "TikTok · Reels · Shorts · X",
                "No audience required",
                `${economics.trackingDays}-day tracking window`,
                "Unspent budget goes back to the brand",
              ].map((t) => (
                <span key={t} className="flex items-center gap-12">
                  {t}
                  <span className="h-1 w-1 rounded-full bg-ember" />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ───────────────────────── Live campaigns ─────────────────────── */}
      <section className="shell py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionTitle
            eyebrow="Open now"
            title="Campaigns taking clips today"
            lede="Sorted by what is still left to earn. Every card shows the rate, the budget remaining and the platforms accepted."
          />
          <ButtonLink href="/campaigns" variant="glass" className="shrink-0">
            See all campaigns
          </ButtonLink>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((c) => (
            <CampaignCard key={c.id} campaign={c} now={at} />
          ))}
        </div>
        {s.hasSamples && (
          <p className="mt-4 text-[12.5px] text-low">
            Campaigns marked <span className="pill h-5 px-1.5 text-[10px]">Sample</span> are seeded examples with
            invented brands so the marketplace is not empty before launch. Nothing in them is escrowed.
          </p>
        )}
      </section>

      {/* ─────────────────────────── How it works ─────────────────────── */}
      <section id="how" className="shell scroll-mt-24 py-14">
        <SectionTitle
          eyebrow="How it works"
          title="Two sides, one escrow"
          lede="The brand's money is on chain before a single clip is posted; the clipper's payout leaves that escrow and nowhere else."
          align="center"
          className="mb-10"
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel card className="p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="display text-[24px]">For clippers</h3>
              <Pill tone="brand">Earn {site.ticker}</Pill>
            </div>
            <Steps
              steps={[
                ["Pick a campaign", "Filter by platform and rate. Read the brief — the requirements are the whole job."],
                ["Cut and post", "Clip the source material, post it on your own TikTok, Reels, Shorts or X account."],
                ["Submit the link", "Paste the post URL. Views are tracked from that moment, for the campaign's tracking window."],
                ["Get paid per 1,000 views", `Once the brand approves and the views are verified, a signed voucher lets you claim ${site.ticker} from the escrow — into your wallet.`],
              ]}
            />
          </Panel>
          <Panel card className="p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="display text-[24px]">For brands</h3>
              <Pill>Fund in {site.ticker}</Pill>
            </div>
            <Steps
              steps={[
                ["Write the brief", "Title, source material, requirements, platforms, a rate per 1,000 views and caps per clip."],
                ["Deposit the budget", `Approve and deposit ${site.ticker} into the escrow contract. A ${economics.feeBps / 100} % platform fee goes on top; the whole budget stays for clippers.`],
                ["Approve or reject", "Every submission lands in your queue with its views. Reject with a reason, approve the rest."],
                ["Get the rest back", `Close the campaign whenever you like. After a ${economics.gracePeriodDays}-day grace period for outstanding vouchers, the unspent budget is withdrawable — by you, and only you.`],
              ]}
            />
          </Panel>
        </div>
      </section>

      {/* ──────────────────────────── The coin ────────────────────────── */}
      <section className="shell py-14">
        <Panel card strong className="overflow-hidden p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div className="flex flex-col gap-5">
              <span className="label text-amber">The currency</span>
              <h2 className="display text-[clamp(30px,4.6vw,52px)]">
                Everything here is priced, paid and held in <span className="brand-text">{site.ticker}</span>.
              </h2>
              <p className="text-[16px] leading-relaxed text-mid">
                That is the whole design. A brand that wants clips has to hold {site.ticker} to fund a campaign. A clipper
                who earns is paid in {site.ticker}. The platform fee is taken in {site.ticker}. There is no dollar rail
                underneath and no conversion step in the middle.
              </p>
              <ul className="mt-2 flex flex-col gap-3 text-[14.5px]">
                {[
                  ["Budgets live in the escrow contract, not in a company account.", "You can read the balance on the explorer at any time."],
                  ["A submission is paid exactly once.", "The contract refuses a second settlement of the same clip, whatever the server says."],
                  ["Vouchers are signed by the platform's verifier.", "The chain cannot read TikTok — someone has to vouch for the view count. That someone is us, and the contract will only pay what we sign, within the budget."],
                ].map(([head, body]) => (
                  <li key={head} className="flex gap-3">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                    <span className="text-mid">
                      <strong className="text-hi">{head}</strong> {body}
                    </span>
                  </li>
                ))}
              </ul>
              <ButtonLink href="/token" variant="glass" className="mt-2 w-fit">
                About the token
              </ButtonLink>
            </div>
            <Flow />
          </div>
        </Panel>
      </section>

      {/* ────────────────────────── Comparison ────────────────────────── */}
      <section className="shell py-14">
        <SectionTitle
          eyebrow="Versus the platforms you know"
          title="Same job. Different plumbing."
          lede="The mechanics of a clipping campaign are not new. Where the money sits, who can move it and what you are paid in — that is what changes."
          className="mb-8"
        />
        <Panel card className="overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th className="w-[34%]"></th>
                <th>Web2 clipping platforms</th>
                <th className="text-amber">{site.name}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Where the budget sits", "The platform's bank account", "An escrow contract, readable by anyone"],
                ["What you are paid in", "Dollars, to a linked payout method", `${site.ticker}, to your wallet`],
                ["Who can move the budget", "The platform", "The contract: clippers via signed vouchers, the brand after a grace period"],
                ["Sign-up", "Email, KYC for payouts", "A wallet"],
                ["Who verifies views", "The platform", "The platform — and the contract enforces once-per-clip and the budget cap"],
                ["Platform fee", "Undisclosed or variable", `${economics.feeBps / 100} % on deposit, on chain, fixed per campaign`],
                ["Price risk", "None — rates are in dollars", `Yes — rates are in ${site.ticker} and its price moves`],
              ].map(([k, a, b]) => (
                <tr key={k}>
                  <td className="font-medium text-hi">{k}</td>
                  <td className="text-mid">{a}</td>
                  <td className="text-hi">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </section>

      {/* ─────────────────────────────── FAQ ──────────────────────────── */}
      <section id="faq" className="shell scroll-mt-24 py-14">
        <SectionTitle eyebrow="Straight answers" title="Questions a careful clipper would ask" className="mb-8" />
        <Faq />
      </section>

      {/* ─────────────────────────────── CTA ──────────────────────────── */}
      <section className="shell py-10">
        <Panel card strong className="relative overflow-hidden px-6 py-12 text-center md:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(255,106,43,.45), transparent 65%)" }}
          />
          <div className="relative flex flex-col items-center gap-5">
            <h2 className="display text-[clamp(30px,5vw,56px)]">The next clip could be yours.</h2>
            <p className="max-w-[46ch] text-[16px] text-mid">
              Open a campaign, read the brief, post the cut. The escrow is waiting.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/campaigns" variant="primary" className="px-6">
                Browse campaigns
              </ButtonLink>
              <ButtonLink href="/launch" variant="glass">
                I have a budget
              </ButtonLink>
            </div>
          </div>
        </Panel>
      </section>
    </>
  );
}

function Steps({ steps }: { steps: [string, string][] }) {
  return (
    <ol className="flex flex-col gap-5">
      {steps.map(([head, body], i) => (
        <li key={head} className="flex gap-4">
          <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--rim-strong)] bg-[var(--glass-2)] text-[13px] font-semibold text-hi">
            {i + 1}
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[15.5px] font-semibold text-hi">{head}</span>
            <span className="text-[14px] leading-relaxed text-mid">{body}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The money's path, as a diagram: brand → escrow → clipper, fee to the side. */
function Flow() {
  const node = (label: string, sub: string, tone?: "brand") => (
    <div
      className={`glass flex min-w-0 flex-col items-center gap-1 rounded-2xl px-4 py-4 text-center ${tone === "brand" ? "border-amber/40" : ""}`}
    >
      <span className={`text-[14px] font-semibold ${tone === "brand" ? "brand-text" : "text-hi"}`}>{label}</span>
      <span className="text-[12px] text-low">{sub}</span>
    </div>
  );
  return (
    <div className="flex flex-col justify-center gap-3">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
        {node("Brand", `buys ${site.ticker}, deposits`)}
        <Arrow />
        {node("Escrow", "holds the budget", "brand")}
        <Arrow />
        {node("Clipper", `claims ${site.ticker}`)}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-2">
        <div />
        <div />
        <div className="flex flex-col items-center gap-1">
          <span className="h-6 w-px bg-[var(--line-strong)]" />
          <div className="glass rounded-2xl px-4 py-3 text-center">
            <span className="block text-[13px] font-semibold text-hi">{economics.feeBps / 100} % fee</span>
            <span className="block text-[11.5px] text-low">to the fee recipient</span>
          </div>
        </div>
        <div />
        <div className="flex flex-col items-center gap-1">
          <span className="h-6 w-px bg-[var(--line-strong)]" />
          <div className="glass rounded-2xl px-4 py-3 text-center">
            <span className="block text-[13px] font-semibold text-hi">signed voucher</span>
            <span className="block text-[11.5px] text-low">views × rate, once per clip</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="26" height="14" viewBox="0 0 26 14" fill="none" className="text-amber" aria-hidden>
      <path d="M0 7h22M17 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
