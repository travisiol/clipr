import { getSession, requireSession } from "@/lib/auth";
import { getCampaign, listSubmissions } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { activatePreview, closeCampaign, fundCampaign, ServiceError } from "@/lib/service";
import { shortAddress, type PublicSubmission } from "@/lib/model";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const campaign = getCampaign(id);
    if (!campaign) return json({ error: "No such campaign." }, { status: 404 });
    const session = await getSession();
    const mine = session && (session.ops || session.address.toLowerCase() === campaign.brand.toLowerCase());
    if (campaign.status === "pending_budget" && !mine) return json({ error: "No such campaign." }, { status: 404 });

    const all = listSubmissions({ campaignId: id });
    const leaderboard: PublicSubmission[] = all
      .filter((s) => s.status !== "rejected")
      .sort((a, b) => b.views - a.views)
      .slice(0, 20)
      .map((s) => ({
        id: s.id,
        platform: s.platform,
        url: s.url,
        status: s.status,
        views: s.views,
        payout: s.payout,
        submittedAt: s.submittedAt,
        clipperShort: shortAddress(s.clipper),
      }));
    return json({
      campaign,
      leaderboard,
      counts: { total: all.length, pending: all.filter((s) => s.status === "pending").length },
      submissions: mine ? all : undefined,
    });
  });
}

/** Brand or ops actions on a campaign. */
export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const auth = await requireSession();
    if ("response" in auth) return auth.response;
    const { id } = await ctx.params;
    const body = await readJson(req);
    switch (body.action) {
      case "close":
        return json({ campaign: closeCampaign(auth.session, id) });
      case "fund":
        return json({ campaign: await fundCampaign(auth.session, id, String(body.txHash ?? "")) });
      case "activate":
        return json({ campaign: activatePreview(auth.session, id) });
      default:
        throw new ServiceError("Unknown action.");
    }
  });
}
