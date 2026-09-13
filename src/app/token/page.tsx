import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/site/Logo";
import { ButtonLink, Notice, Panel, Pill, SectionTitle, Stat } from "@/components/ui";
import { stats } from "@/lib/db";
import { fmtToken } from "@/lib/format";
import { robinhoodChain } from "@/lib/chain";
import { contracts, isLive } from "@/lib/contracts";
import { economics, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `${site.ticker} token`,
  description: `${site.ticker} is the only currency on ${site.name}: campaign budgets are deposited in it, clippers are paid in it, the fee is taken in it.`,
};

export default async function TokenPage() {
  const s = stats();
  const explorer = robinhoodChain.blockExplorers?.default.url;
  const addr = (a: `0x${string}` | null, label: string) => (
    <div className="flex flex-col gap-1">
      <span className="label">{label}</span>
      {a ? (
        <a href={`${explorer}/address/${a}`} target="_blank" rel="noreferrer" className="num text-[13px] break-all text-amber hover:underline">
          {a}
        </a>
      ) : (
        <span className="num text-[13px] text-low">awaiting launch</span>
      )}
    </div>
  );

  return (
    <section className="shell flex flex-col gap-12 py-10 md:py-14">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-5">
          <Pill tone="brand" className="w-fit">
            <span className="dot-live" aria-hidden />
            {isLive ? `Live on ${robinhoodChain.name}` : "Not launched"}
          </Pill>
          <h1 className="display text-[clamp(40px,6.4vw,80px)]">
            <span className="brand-text">{site.ticker}</span>
            <br />
            the coin you get paid in.
          </h1>
          <p className="max-w-[54ch] text-[17px] leading-relaxed text-mid">
            {site.ticker} is not a governance token, a points system or a promise of revenue. It is the unit every campaign on{" "}
            {site.name} is priced in, funded in and paid out in. A brand cannot post a budget without holding it; a clipper cannot be
            paid in anything else.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/launch" variant="primary">
              Fund a campaign
            </ButtonLink>
            <ButtonLink href="/campaigns" variant="glass">
              Earn it
            </ButtonLink>
          </div>
        </div>
        <div className="relative mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center">
          <div
            aria-hidden
            className="absolute inset-[12%] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(255,120,60,.55), rgba(255,106,43,.12) 60%, transparent 75%)" }}
          />
          <Mark size={300} className="relative drop-shadow-[0_30px_60px_rgba(0,0,0,.6)]" />
        </div>
      </div>

      <Panel className="grid grid-cols-2 gap-6 px-6 py-5 md:grid-cols-4">
        <Stat label="In escrow now" value={fmtToken(s.escrowed, { compact: true })} unit={site.ticker} tone="brand" />
        <Stat label="Paid to clippers" value={fmtToken(s.paid, { compact: true })} unit={site.ticker} />
        <Stat label="Platform fee" value={`${economics.feeBps / 100} %`} hint="on every deposit, on top of the budget" />
        <Stat label="Chain" value={robinhoodChain.name} hint={`chain id ${robinhoodChain.id}`} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        {[
          [
            "Demand",
            `Every campaign is a purchase of ${site.ticker}. A brand with a dollar budget has to buy the coin to deposit it, and the fee on top is taken in the coin too.`,
          ],
          [
            "Supply pressure",
            `Clippers are paid in ${site.ticker} and many will sell. The design does not hide this: it is the same flow as any marketplace paying contractors in a currency they do not spend.`,
          ],
          [
            "The fee's destination",
            `${economics.feeBps / 100} % of every deposit is forwarded by the escrow contract to a fee recipient set at deployment. A treasury or a burn address — one constructor argument, changeable by the owner for future deposits only.`,
          ],
        ].map(([head, body]) => (
          <Panel key={head} card className="flex flex-col gap-2 p-6">
            <h2 className="display text-[20px]">{head}</h2>
            <p className="text-[14.5px] leading-relaxed text-mid">{body}</p>
          </Panel>
        ))}
      </div>

      <div id="contract" className="scroll-mt-24">
        <SectionTitle eyebrow="Contracts" title="What is on chain" className="mb-6" />
        <Panel card className="flex flex-col gap-6 p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            {addr(contracts.token, `${site.ticker} token (ERC-20)`)}
            {addr(contracts.escrow, "ClipEscrow")}
          </div>
          <div className="grid gap-4 text-[14px] text-mid md:grid-cols-2">
            <ul className="flex flex-col gap-2">
              <li>
                <strong className="text-hi">createCampaign(budget, endsAt, briefHash)</strong> — pulls budget + fee, keeps the budget, forwards the fee.
              </li>
              <li>
                <strong className="text-hi">settle(campaignId, submissionId, clipper, amount, deadline, sig)</strong> — pays once per submission, only
                what the verifier signed, never past the budget.
              </li>
              <li>
                <strong className="text-hi">close / withdraw</strong> — the brand closes; after {economics.gracePeriodDays} days the unspent budget comes back.
              </li>
            </ul>
            <ul className="flex flex-col gap-2">
              <li>
                <strong className="text-hi">No owner path to funds.</strong> The owner rotates the signer and sets the fee for future deposits. That is
                the whole admin surface.
              </li>
              <li>
                <strong className="text-hi">Vouchers are EIP-712 typed data</strong>, dated, bound to a campaign, a submission, a recipient and an amount.
              </li>
              <li>
                <strong className="text-hi">Source and tests</strong> ship with the app (<span className="num">contracts/</span>, 21 passing tests). Not audited.
              </li>
            </ul>
          </div>
          {!isLive && (
            <Notice tone="brand" title="Nothing is deployed yet">
              The contracts are written and tested; the token has not launched. Until both addresses above resolve, the marketplace runs in preview:
              campaigns list without escrow, payouts are computed but cannot be claimed, and every screen says so. See the{" "}
              <Link href="/#faq" className="underline underline-offset-4">
                FAQ
              </Link>
              .
            </Notice>
          )}
        </Panel>
      </div>

      <Panel card strong className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="label text-amber">Where to get it</span>
        <h2 className="display text-[clamp(26px,4vw,40px)]">Trading opens at launch.</h2>
        <p className="max-w-[46ch] text-[15px] text-mid">
          The launch venue and the initial supply are not decided. When they are, this is where the link goes — not before.
        </p>
      </Panel>
    </section>
  );
}
