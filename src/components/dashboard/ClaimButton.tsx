"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConnection, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { Button } from "@/components/ui";
import { robinhoodChain } from "@/lib/chain";
import { patchSubmission } from "@/lib/client";
import { clipEscrowAbi, contracts, isLive } from "@/lib/contracts";
import type { Submission } from "@/lib/model";

/**
 * Redeem a voucher: one `settle` transaction from any wallet (the payout
 * goes to the clipper the voucher names), then tell the server the hash so
 * it can read the receipt and mark the clip paid.
 */
export function ClaimButton({ submission: s }: { submission: Submission }) {
  const router = useRouter();
  const { chainId } = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  if (s.status !== "settled") return null;
  if (!s.voucher) {
    return (
      <span className="text-[12px] text-low" title="The payout is fixed; a voucher will be issued once the escrow signer is configured">
        voucher pending
      </span>
    );
  }
  if (!isLive || !contracts.escrow) {
    return <span className="text-[12px] text-low">claim opens at launch</span>;
  }
  const escrow = contracts.escrow;
  const v = s.voucher;
  const expired = v.deadline * 1000 < now;

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      if (!publicClient) throw new Error("No RPC client.");
      if (chainId !== robinhoodChain.id) await switchChainAsync({ chainId: robinhoodChain.id });
      const hash = await writeContractAsync({
        address: escrow,
        abi: clipEscrowAbi,
        functionName: "settle",
        args: [BigInt(v.campaignId), v.submissionId, v.clipper, BigInt(v.amount), BigInt(v.deadline), v.signature],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The claim transaction reverted.");
      await patchSubmission(s.id, { action: "paid", txHash: hash });
      router.refresh();
    } catch (err) {
      setError(((err as Error).message ?? "Claim failed.").split("\n")[0].slice(0, 160));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <Button size="xs" variant="primary" busy={busy} disabled={expired} onClick={() => void claim()} title={expired ? "This voucher expired — ask ops to re-issue it" : undefined}>
        {expired ? "Expired" : "Claim"}
      </Button>
      {error && <span className="max-w-[240px] text-right text-[11.5px] text-bad">{error}</span>}
    </span>
  );
}
