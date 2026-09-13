import "server-only";
import { createPublicClient, http, parseEventLogs } from "viem";
import { robinhoodChain } from "@/lib/chain";
import { clipEscrowAbi, contracts, isLive } from "@/lib/contracts";

/**
 * The server's read-only view of the chain, used to confirm what a wallet
 * claims to have done: "I funded this campaign" and "I redeemed this
 * voucher" are both checked against the transaction receipt before the
 * database changes. In preview mode there is no chain to ask and both
 * confirmations are refused with a reason.
 */

const client = () => createPublicClient({ chain: robinhoodChain, transport: http() });

export async function confirmFunding(txHash: `0x${string}`, expected: { brand: `0x${string}`; budget: bigint }) {
  if (!isLive || !contracts.escrow) return { ok: false as const, reason: "Escrow not deployed — preview mode." };
  const receipt = await client().getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") return { ok: false as const, reason: "Transaction reverted." };
  const logs = parseEventLogs({ abi: clipEscrowAbi, logs: receipt.logs, eventName: "CampaignCreated" });
  const log = logs.find((l) => l.address.toLowerCase() === contracts.escrow!.toLowerCase());
  if (!log) return { ok: false as const, reason: "No CampaignCreated event from the escrow in that transaction." };
  if (log.args.brand.toLowerCase() !== expected.brand.toLowerCase()) {
    return { ok: false as const, reason: "That campaign was funded by a different wallet." };
  }
  if (log.args.budget !== expected.budget) {
    return { ok: false as const, reason: "Deposited budget does not match the campaign." };
  }
  return { ok: true as const, escrowId: Number(log.args.campaignId) };
}

export async function confirmSettlement(txHash: `0x${string}`, expected: { submissionKey: `0x${string}` }) {
  if (!isLive || !contracts.escrow) return { ok: false as const, reason: "Escrow not deployed — preview mode." };
  const receipt = await client().getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") return { ok: false as const, reason: "Transaction reverted." };
  const logs = parseEventLogs({ abi: clipEscrowAbi, logs: receipt.logs, eventName: "Settled" });
  const log = logs.find(
    (l) =>
      l.address.toLowerCase() === contracts.escrow!.toLowerCase() &&
      l.args.submissionId.toLowerCase() === expected.submissionKey.toLowerCase(),
  );
  if (!log) return { ok: false as const, reason: "No Settled event for this submission in that transaction." };
  return { ok: true as const, amount: log.args.amount, clipper: log.args.clipper };
}
