"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { patchCampaign } from "@/lib/client";
import type { Campaign } from "@/lib/model";

/** Preview-only lever: list a campaign that has no deposit behind it. */
export function OpsCampaignActions({ campaign, live }: { campaign: Campaign; live: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (live) return <span className="text-[12px] text-low">waits for the brand&apos;s deposit</span>;

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      await patchCampaign(campaign.id, { action: "activate" });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <Button size="xs" busy={busy} onClick={() => void activate()} title="Preview only — lists the campaign without a deposit">
        Activate (preview)
      </Button>
      {error && <span className="text-[11.5px] text-bad">{error}</span>}
    </span>
  );
}
