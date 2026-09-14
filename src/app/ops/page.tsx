import type { Metadata } from "next";
import Link from "next/link";
import { SubmissionRow } from "@/components/campaign/SubmissionRow";
import { SignInGate } from "@/components/dashboard/SignInGate";
import { OpsCampaignActions } from "@/components/ops/OpsCampaignActions";
import { Notice, Panel, Pill, SectionTitle, Stat } from "@/components/ui";
import { getSession, opsIsOpen } from "@/lib/auth";
import { listCampaigns, listSubmissions, storageInfo } from "@/lib/db";
import { fmtToken, timeAgo } from "@/lib/format";
import { trackingEndsAt, type Campaign } from "@/lib/model";
import { economics, site } from "@/lib/site";
import { isLive } from "@/lib/contracts";
import { signerStatus } from "@/lib/voucher";
import { now as clock } from "@/lib/clock";

export const metadata: Metadata = { title: "Ops" };

export default async function OpsPage() {
  const session = await getSession();
  if (!session) {
    return (
      <section className="shell py-14">
        <SignInGate title="Ops" lede="The operator's desk: verify views, settle approved clips, list pending campaigns." />
      </section>
    );
  }
  if (!session.ops) {
    return (
      <section className="shell py-14">
        <Notice tone="bad" title="Ops only">
          <span className="num">{session.address}</span> is not in OPS_ADDRESSES.
        </Notice>
      </section>
    );
  }

  const campaigns = listCampaigns({ includePending: true });
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const queue = listSubmissions({ status: ["pending", "approved", "settled"] });
  const now = clock();
  const readyToSettle = queue.filter((s) => s.status === "approved" && now >= trackingEndsAt(s.submittedAt, economics.trackingDays));
  const stillTracking = queue.filter((s) => s.status === "approved" && now < trackingEndsAt(s.submittedAt, economics.trackingDays));
  const inReview = queue.filter((s) => s.status === "pending");
  const settled = queue.filter((s) => s.status === "settled");
  const pendingCampaigns = campaigns.filter((c) => c.status === "pending_budget");
  const signer = signerStatus();
  const storage = storageInfo();

  const outstanding = settled.reduce((acc, s) => acc + BigInt(s.payout), 0n);

  return (
    <section className="shell flex flex-col gap-8 py-10 md:py-14">
      <SectionTitle
        eyebrow="Operator"
        title="Ops desk"
        lede="Everything that needs a human: verified view counts, settlements, and campaigns waiting to be listed."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Panel className="flex flex-col gap-2 p-5">
          <span className="label">Mode</span>
          <span className="flex items-center gap-2 text-[15px] font-semibold text-hi">
            <span className={`h-2 w-2 rounded-full ${isLive ? "bg-ok" : "bg-low"}`} />
            {isLive ? "Live — escrow deployed" : "Preview — no escrow"}
          </span>
          <span className="text-[12.5px] text-low">
            {opsIsOpen() ? "OPS_ADDRESSES is unset, so every signed-in wallet is ops in preview." : "Restricted to OPS_ADDRESSES."}
          </span>
          <span className={`text-[12.5px] ${storage.ephemeral ? "text-amber" : "text-low"}`}>
            {storage.ephemeral
              ? "Storage is ephemeral (read-only host): the database resets on every cold start. Set CLIPR_DB_PATH or a hosted database before real use."
              : `Database on disk: ${storage.path}`}
          </span>
        </Panel>
        <Panel className="flex flex-col gap-2 p-5">
          <span className="label">Voucher signer</span>
          {signer.ready ? (
            <>
              <span className="text-[15px] font-semibold text-ok">Ready</span>
              <span className="num text-[12px] text-low">{signer.address}</span>
            </>
          ) : (
            <>
              <span className="text-[15px] font-semibold text-hi">Not signing</span>
              <span className="text-[12.5px] text-low">{signer.reason}</span>
            </>
          )}
        </Panel>
        <Panel className="p-5">
          <Stat label="Outstanding vouchers" value={fmtToken(outstanding)} unit={site.ticker} hint={`${settled.length} settled, not yet redeemed`} />
        </Panel>
      </div>

      {pendingCampaigns.length > 0 && (
        <Panel card className="flex flex-col gap-3 p-6">
          <h2 className="display text-[20px]">Campaigns pending budget</h2>
          {pendingCampaigns.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--line-soft)] py-3 text-[13.5px] last:border-0">
              <Link href={`/campaigns/${c.id}`} className="font-medium text-hi hover:text-amber">
                {c.title}
              </Link>
              <span className="text-mid">{c.brandName}</span>
              <span className="num text-low">
                {fmtToken(c.budget)} {site.ticker}
              </span>
              <span className="text-low">{timeAgo(c.createdAt)}</span>
              <span className="ml-auto">
                <OpsCampaignActions campaign={c} live={isLive} />
              </span>
            </div>
          ))}
        </Panel>
      )}

      <Queue title="Ready to settle" hint="Tracking window over. Record the final verified count, then settle." items={readyToSettle} byId={byId} />
      <Queue title="Approved · still tracking" hint="Update counts as you go; settle when the window closes (or early on purpose)." items={stillTracking} byId={byId} />
      <Queue title="In review by brands" hint="Brands approve their own queues; ops can step in." items={inReview} byId={byId} />
      <Queue title="Settled · awaiting claim" hint="Vouchers signed. Nothing to do unless one expires." items={settled} byId={byId} collapsed />
    </section>
  );
}

function Queue({
  title,
  hint,
  items,
  byId,
  collapsed,
}: {
  title: string;
  hint: string;
  items: ReturnType<typeof listSubmissions>;
  byId: Map<string, Campaign>;
  collapsed?: boolean;
}) {
  return (
    <Panel card className="p-6">
      <details open={!collapsed && items.length > 0} className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span className="text-amber transition-transform group-open:rotate-90" aria-hidden>
            ▸
          </span>
          <h2 className="display text-[20px]">{title}</h2>
          <Pill tone={items.length > 0 ? "brand" : "default"}>{items.length}</Pill>
          <span className="text-[12.5px] text-low">{hint}</span>
        </summary>
        <div className="mt-2">
          {items.length === 0 ? (
            <p className="py-3 text-[13px] text-low">Empty.</p>
          ) : (
            items.map((s) => {
              const c = byId.get(s.campaignId);
              return c ? <SubmissionRow key={s.id} campaign={c} submission={s} ops showCampaign /> : null;
            })
          )}
        </div>
      </details>
    </Panel>
  );
}
