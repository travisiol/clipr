"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmissionRow } from "@/components/campaign/SubmissionRow";
import { FundButton } from "@/components/campaign/FundButton";
import { Button, Notice, Panel, Pill } from "@/components/ui";
import { patchCampaign } from "@/lib/client";
import { economics } from "@/lib/site";
import type { Campaign, Submission } from "@/lib/model";

/**
 * The brand's desk on its own campaign page: the queue, and the two big
 * levers — fund (live) / activate (preview) and close.
 */
export function ReviewQueue({
  campaign,
  submissions,
  isBrand,
  ops,
}: {
  campaign: Campaign;
  submissions: Submission[];
  isBrand: boolean;
  ops: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const pending = submissions.filter((s) => s.status === "pending");
  const approved = submissions.filter((s) => s.status === "approved");
  const done = submissions.filter((s) => s.status === "settled" || s.status === "paid" || s.status === "rejected");

  async function act(label: string, body: Parameters<typeof patchCampaign>[1]) {
    setBusy(label);
    setError(null);
    try {
      await patchCampaign(campaign.id, body);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel card className="flex flex-col gap-5 p-6" id="review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="display text-[20px]">Review queue</h2>
          <Pill tone={isBrand ? "brand" : "hi"}>{isBrand ? "Your campaign" : "Ops view"}</Pill>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "pending_budget" && isBrand && <FundButton campaign={campaign} />}
          {campaign.status === "pending_budget" && ops && (
            <Button size="sm" busy={busy === "activate"} onClick={() => act("activate", { action: "activate" })} title="Preview only — lists the campaign without a deposit">
              Activate (preview)
            </Button>
          )}
          {campaign.status === "active" && (
            confirmClose ? (
              <>
                <Button size="sm" variant="bad" busy={busy === "close"} onClick={() => act("close", { action: "close" })}>
                  Yes, close it
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClose(false)}>
                  Keep open
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setConfirmClose(true)}>
                Close campaign
              </Button>
            )
          )}
        </div>
      </div>

      {confirmClose && (
        <Notice tone="brand">
          Closing stops new submissions. Approved clips still settle for {economics.gracePeriodDays} days; after that the unspent budget can be withdrawn by
          the brand&apos;s wallet.
        </Notice>
      )}
      {error && <Notice tone="bad">{error}</Notice>}

      <Section title="Waiting for your decision" count={pending.length} empty="Nothing waiting.">
        {pending.map((s) => (
          <SubmissionRow key={s.id} campaign={campaign} submission={s} ops={ops} />
        ))}
      </Section>
      <Section title="Approved · tracking views" count={approved.length} empty="No approved clips yet.">
        {approved.map((s) => (
          <SubmissionRow key={s.id} campaign={campaign} submission={s} ops={ops} />
        ))}
      </Section>
      <Section title="Settled, paid and rejected" count={done.length} empty="Nothing settled yet." collapsed>
        {done.map((s) => (
          <SubmissionRow key={s.id} campaign={campaign} submission={s} ops={ops} />
        ))}
      </Section>
    </Panel>
  );
}

function Section({
  title,
  count,
  empty,
  collapsed,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={!collapsed && count > 0} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-hi [&::-webkit-details-marker]:hidden">
        <span className="text-amber transition-transform group-open:rotate-90" aria-hidden>
          ▸
        </span>
        {title}
        <span className="num text-low">{count}</span>
      </summary>
      <div className="mt-1 pl-4">{count === 0 ? <p className="py-3 text-[13px] text-low">{empty}</p> : children}</div>
    </details>
  );
}
