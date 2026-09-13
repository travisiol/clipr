import type { Metadata } from "next";
import { LaunchWizard } from "@/components/launch/LaunchWizard";
import { SectionTitle } from "@/components/ui";
import { isLive } from "@/lib/contracts";
import { economics, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Launch a campaign",
  description: `Write the brief, set a rate per 1,000 views, deposit ${site.ticker} into escrow. Clippers do the rest.`,
};

export default function LaunchPage() {
  return (
    <section className="shell py-10 md:py-14">
      <SectionTitle
        eyebrow="For brands"
        title="Launch a campaign"
        lede={`A brief, a rate, a budget in ${site.ticker}. The budget sits in an escrow contract you can read on the explorer; clippers are paid from it against verified views, and whatever they do not earn comes back to you ${economics.gracePeriodDays} days after you close.`}
        className="mb-8"
      />
      <LaunchWizard live={isLive} />
    </section>
  );
}
