"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Panel, SectionTitle } from "@/components/ui";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useSession } from "@/components/wallet/session";

/**
 * A server page that needs a session renders this instead of its content.
 * Once the wallet signs in, the page is refreshed and renders for real.
 */
export function SignInGate({ title, lede }: { title: string; lede: string }) {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.refresh();
  }, [session, router]);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6">
      <SectionTitle eyebrow="Wallet required" title={title} lede={lede} />
      <Panel card className="flex flex-col gap-3 p-6">
        <WalletButton full />
        <p className="text-[12.5px] leading-relaxed text-low">
          Signing in is a message signature — no transaction, no gas. Your wallet address is your account.
        </p>
      </Panel>
    </div>
  );
}
