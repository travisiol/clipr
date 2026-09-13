"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { keccak256, toBytes } from "viem";
import { useConnection, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { Button, Notice } from "@/components/ui";
import { robinhoodChain } from "@/lib/chain";
import { patchCampaign } from "@/lib/client";
import { clipEscrowAbi, clipTokenAbi, contracts, isLive } from "@/lib/contracts";
import { fmtToken } from "@/lib/format";
import { briefPayload, type Campaign } from "@/lib/model";
import { economics, site } from "@/lib/site";

/**
 * The deposit. Two transactions from the brand's wallet — approve the
 * escrow for budget + fee, then `createCampaign` — and one confirmation to
 * the server, which reads the receipt itself before listing the campaign.
 */
export function FundButton({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const { address, chainId } = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<"idle" | "approve" | "deposit" | "confirm">("idle");
  const [error, setError] = useState<string | null>(null);

  const budget = BigInt(campaign.budget);
  const fee = (budget * BigInt(economics.feeBps)) / 10_000n;
  const total = budget + fee;

  if (!isLive || !contracts.escrow || !contracts.token) {
    return (
      <span className="text-[12.5px] text-low" title="Set NEXT_PUBLIC_CLIPR_ESCROW_ADDRESS, NEXT_PUBLIC_CLIPR_TOKEN_ADDRESS and NEXT_PUBLIC_CLIPR_LIVE">
        Deposit unavailable — escrow not deployed
      </span>
    );
  }
  const escrow = contracts.escrow;
  const token = contracts.token;

  async function fund() {
    setError(null);
    try {
      if (!address) throw new Error("Connect the brand wallet first.");
      if (address.toLowerCase() !== campaign.brand.toLowerCase()) throw new Error("Switch to the wallet that created this campaign.");
      if (!publicClient) throw new Error("No RPC client.");
      if (chainId !== robinhoodChain.id) await switchChainAsync({ chainId: robinhoodChain.id });

      const allowance = await publicClient.readContract({
        address: token,
        abi: clipTokenAbi,
        functionName: "allowance",
        args: [address, escrow],
      });
      if (allowance < total) {
        setStep("approve");
        const hash = await writeContractAsync({ address: token, abi: clipTokenAbi, functionName: "approve", args: [escrow, total] });
        await publicClient.waitForTransactionReceipt({ hash });
      }
      setStep("deposit");
      const briefHash = keccak256(toBytes(briefPayload(campaign)));
      const hash = await writeContractAsync({
        address: escrow,
        abi: clipEscrowAbi,
        functionName: "createCampaign",
        args: [budget, BigInt(Math.floor(campaign.endsAt / 1000)), briefHash],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The deposit transaction reverted.");
      setStep("confirm");
      await patchCampaign(campaign.id, { action: "fund", txHash: hash });
      router.refresh();
    } catch (err) {
      setError(((err as Error).message ?? "Deposit failed.").split("\n")[0].slice(0, 200));
    } finally {
      setStep("idle");
    }
  }

  return (
    <span className="flex flex-col items-end gap-2">
      <Button size="sm" variant="primary" busy={step !== "idle"} onClick={() => void fund()}>
        {step === "approve"
          ? "Approve in wallet…"
          : step === "deposit"
            ? "Depositing…"
            : step === "confirm"
              ? "Confirming…"
              : `Deposit ${fmtToken(total)} ${site.ticker}`}
      </Button>
      <span className="text-[11.5px] text-low">
        {fmtToken(budget)} budget + {fmtToken(fee)} fee ({economics.feeBps / 100} %)
      </span>
      {error && <Notice tone="bad" className="max-w-[360px]">{error}</Notice>}
    </span>
  );
}
