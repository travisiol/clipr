import type { Metadata } from "next";
import { CampaignBrowser } from "@/components/campaigns/CampaignBrowser";
import { SectionTitle } from "@/components/ui";
import { listCampaigns } from "@/lib/db";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Campaigns",
  description: `Every open clipping campaign, its rate per 1,000 views in ${site.ticker} and the budget left to earn.`,
};

export default async function CampaignsPage() {
  const campaigns = listCampaigns();
  return (
    <section className="shell py-10 md:py-14">
      <SectionTitle
        eyebrow="Discover"
        title="Campaigns"
        lede="Pick by platform and rate. The bar on each card is the budget draining — what is left is yours to earn."
        className="mb-8"
      />
      <CampaignBrowser campaigns={campaigns} />
    </section>
  );
}
