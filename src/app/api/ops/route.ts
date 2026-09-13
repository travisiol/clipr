import { opsIsOpen, requireSession } from "@/lib/auth";
import { listCampaigns, listSubmissions } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { signerStatus } from "@/lib/voucher";
import { isLive } from "@/lib/contracts";
import type { Campaign } from "@/lib/model";

/** The operator's desk: what is waiting to be verified, settled or listed. */
export async function GET() {
  return handle(async () => {
    const auth = await requireSession();
    if ("response" in auth) return auth.response;
    if (!auth.session.ops) return json({ error: "Ops only." }, { status: 403 });

    const campaigns = listCampaigns({ includePending: true });
    const byId: Record<string, Campaign> = Object.fromEntries(campaigns.map((c) => [c.id, c]));
    const queue = listSubmissions({ status: ["pending", "approved", "settled"] });
    return json({
      isLive,
      opsOpen: opsIsOpen(),
      signer: signerStatus(),
      campaigns: byId,
      pendingCampaigns: campaigns.filter((c) => c.status === "pending_budget"),
      queue,
    });
  });
}
