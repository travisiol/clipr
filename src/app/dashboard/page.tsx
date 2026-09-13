import type { Metadata } from "next";
import Link from "next/link";
import { ClaimButton } from "@/components/dashboard/ClaimButton";
import { SignInGate } from "@/components/dashboard/SignInGate";
import { ButtonLink, Panel, Pill, PlatformIcon, Progress, SectionTitle, Stat, StatusPill } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getCampaign, listCampaigns, listSubmissions } from "@/lib/db";
import { fmtToken, fmtViews, pct, timeAgo, timeLeft } from "@/lib/format";
import { earnedFor, remainingBudget, shortAddress, type Campaign } from "@/lib/model";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "My clips" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    return (
      <section className="shell py-14">
        <SignInGate title="My clips" lede="Sign in with the wallet you submit from to see your clips, what they have earned and what is claimable." />
      </section>
    );
  }

  const submissions = listSubmissions({ clipper: session.address });
  const campaigns = new Map<string, Campaign>();
  for (const s of submissions) if (!campaigns.has(s.campaignId)) campaigns.set(s.campaignId, getCampaign(s.campaignId)!);
  const mine = listCampaigns({ brand: session.address });

  let claimable = 0n;
  let paid = 0n;
  let tracking = 0n;
  for (const s of submissions) {
    const c = campaigns.get(s.campaignId);
    if (s.status === "settled") claimable += BigInt(s.payout);
    else if (s.status === "paid") paid += BigInt(s.payout);
    else if ((s.status === "pending" || s.status === "approved") && c) tracking += earnedFor(c, s.views);
  }

  return (
    <section className="shell flex flex-col gap-10 py-10 md:py-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <SectionTitle eyebrow="Signed in" title="My clips" lede={<span className="num">{session.address}</span>} />
        <ButtonLink href="/campaigns" variant="primary" className="shrink-0">
          Find a campaign
        </ButtonLink>
      </div>

      <Panel className="grid grid-cols-2 gap-6 px-6 py-5 md:grid-cols-4">
        <Stat label="Claimable" value={fmtToken(claimable)} unit={site.ticker} tone="brand" hint="vouchers signed, not yet redeemed" />
        <Stat label="Paid" value={fmtToken(paid)} unit={site.ticker} tone="ok" hint="redeemed on chain" />
        <Stat label="Tracking" value={fmtToken(tracking)} unit={site.ticker} hint="earned so far, not yet settled" />
        <Stat label="Clips" value={submissions.length} hint={`${submissions.filter((s) => s.status === "rejected").length} rejected`} />
      </Panel>

      <Panel card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="display text-[20px]">Submissions</h2>
          <span className="text-[12.5px] text-low">newest first</span>
        </div>
        {submissions.length === 0 ? (
          <p className="px-6 pb-6 text-[14px] text-mid">
            Nothing yet.{" "}
            <Link href="/campaigns" className="text-amber underline-offset-4 hover:underline">
              Pick a campaign
            </Link>{" "}
            and submit your first clip.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Clip</th>
                  <th>Campaign</th>
                  <th className="text-right">Views</th>
                  <th className="text-right">Earned</th>
                  <th>Status</th>
                  <th className="text-right">Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const c = campaigns.get(s.campaignId)!;
                  const earned = s.status === "settled" || s.status === "paid" ? BigInt(s.payout) : s.status === "rejected" ? 0n : earnedFor(c, s.views);
                  return (
                    <tr key={s.id}>
                      <td>
                        <a href={s.url} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-2 text-hi hover:text-amber">
                          <PlatformIcon platform={s.platform} className="h-3.5 w-3.5" />
                          <span className="max-w-[200px] truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        </a>
                      </td>
                      <td>
                        <Link href={`/campaigns/${c.id}`} className="block max-w-[220px] truncate text-mid hover:text-hi">
                          {c.title}
                        </Link>
                      </td>
                      <td className="num text-right text-hi">{fmtViews(s.views)}</td>
                      <td className="num text-right text-hi">
                        {fmtToken(earned)} <span className="text-[11px] text-low">{site.ticker}</span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <StatusPill status={s.status} />
                          {s.reason && <span className="max-w-[220px] text-[11.5px] text-bad">{s.reason}</span>}
                        </div>
                      </td>
                      <td className="text-right text-low">{timeAgo(s.submittedAt)}</td>
                      <td className="text-right">
                        <ClaimButton submission={s} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Brand side */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="display text-[24px]">My campaigns</h2>
          <ButtonLink href="/launch" size="sm">
            Launch another
          </ButtonLink>
        </div>
        {mine.length === 0 ? (
          <Panel card className="p-6 text-[14px] text-mid">
            No campaigns from <span className="num">{shortAddress(session.address)}</span> yet.
          </Panel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {mine.map((c) => {
              const subs = listSubmissions({ campaignId: c.id });
              const pending = subs.filter((s) => s.status === "pending").length;
              return (
                <Link key={c.id} href={`/campaigns/${c.id}#review`} className="glass glass-card flex flex-col gap-3 p-5 transition-transform hover:-translate-y-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="display truncate text-[17px]">{c.title}</span>
                    {c.status === "pending_budget" ? (
                      <Pill tone="brand">Pending budget</Pill>
                    ) : c.status === "closed" ? (
                      <Pill tone="bad">Closed</Pill>
                    ) : (
                      <Pill tone="ok">Active</Pill>
                    )}
                  </div>
                  <Progress value={pct(BigInt(c.spent), BigInt(c.budget))} />
                  <div className="flex items-center justify-between text-[12.5px] text-mid">
                    <span>
                      <span className="num text-hi">{fmtToken(remainingBudget(c))}</span> {site.ticker} left
                    </span>
                    <span>
                      {subs.length} clips · {pending > 0 ? <span className="text-amber">{pending} to review</span> : "queue clear"}
                    </span>
                    <span className="text-low">{c.status === "closed" ? "closed" : timeLeft(c.endsAt)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
