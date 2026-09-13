import { ButtonLink, SectionTitle } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="shell flex flex-col items-start gap-6 py-24">
      <SectionTitle eyebrow="404" title="Nothing here." lede="The campaign may have been removed, or the link was cut mid-sentence." />
      <ButtonLink href="/campaigns" variant="primary">
        Browse campaigns
      </ButtonLink>
    </section>
  );
}
