import "server-only";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodChain } from "@/lib/chain";
import { contracts, escrowDomain, isLive, settlementTypes } from "@/lib/contracts";
import { economics } from "@/lib/site";
import type { Voucher } from "@/lib/model";

/**
 * The verifier's signature. A voucher is what turns "the platform says this
 * clip earned 37.5 CLIPR" into something the escrow will pay: the same
 * EIP-712 struct the contract hashes, signed by the key whose address was
 * passed to the constructor as `signer`.
 *
 * Without the key (or without a deployed escrow) nothing is signed — the
 * submission still settles in the database with its payout fixed, and the
 * dashboard shows a "voucher pending" state instead of a claim button.
 * Nothing is ever promised that the chain cannot honour.
 */

/** The submission id as the contract sees it. */
export const submissionKey = (submissionId: string): `0x${string}` => keccak256(toBytes(submissionId));

export function signerStatus(): { ready: true; address: `0x${string}` } | { ready: false; reason: string } {
  const key = process.env.SETTLEMENT_SIGNER_KEY?.trim();
  if (!isLive || !contracts.escrow) return { ready: false, reason: "Escrow not deployed — preview mode." };
  if (!key) return { ready: false, reason: "SETTLEMENT_SIGNER_KEY is not set on the server." };
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return { ready: false, reason: "SETTLEMENT_SIGNER_KEY is malformed." };
  return { ready: true, address: privateKeyToAccount(key as `0x${string}`).address };
}

export async function signVoucher(input: {
  escrowCampaignId: number;
  submissionId: string;
  clipper: `0x${string}`;
  amount: bigint;
}): Promise<Voucher | null> {
  const status = signerStatus();
  if (!status.ready || !contracts.escrow) return null;
  const account = privateKeyToAccount(process.env.SETTLEMENT_SIGNER_KEY!.trim() as `0x${string}`);
  const deadline = Math.floor(Date.now() / 1000) + economics.voucherDays * 24 * 60 * 60;
  const submissionKeyHex = submissionKey(input.submissionId);
  const signature = await account.signTypedData({
    domain: escrowDomain(robinhoodChain.id, contracts.escrow),
    types: settlementTypes,
    primaryType: "Settlement",
    message: {
      campaignId: BigInt(input.escrowCampaignId),
      submissionId: submissionKeyHex,
      clipper: input.clipper,
      amount: input.amount,
      deadline: BigInt(deadline),
    },
  });
  return {
    campaignId: input.escrowCampaignId,
    submissionId: submissionKeyHex,
    clipper: input.clipper,
    amount: input.amount.toString(),
    deadline,
    signature,
  };
}
