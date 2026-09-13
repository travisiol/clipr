import { requireSession } from "@/lib/auth";
import { getCampaign, listCampaigns } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { earningsFor } from "@/lib/service";
import type { Campaign } from "@/lib/model";

/** The signed-in wallet's side of the marketplace: clips and campaigns. */
export async function GET() {
  return handle(async () => {
    const auth = await requireSession();
    if ("response" in auth) return auth.response;
    const { address } = auth.session;
    const earnings = earningsFor(address);
    const campaignIds = [...new Set(earnings.submissions.map((s) => s.campaignId))];
    const campaigns: Record<string, Campaign> = {};
    for (const id of campaignIds) {
      const c = getCampaign(id);
      if (c) campaigns[id] = c;
    }
    return json({
      session: auth.session,
      submissions: earnings.submissions,
      campaigns,
      earnings: {
        claimable: earnings.claimable.toString(),
        paid: earnings.paid.toString(),
        tracking: earnings.tracking.toString(),
      },
      myCampaigns: listCampaigns({ brand: address }),
    });
  });
}
