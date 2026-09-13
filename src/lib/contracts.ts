import { clipEscrowAbi } from "@/lib/abi/ClipEscrow";
import { clipTokenAbi } from "@/lib/abi/ClipToken";

function envAddress(value: string | undefined): `0x${string}` | null {
  const v = value?.trim();
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : null;
}

/**
 * Chain surface. Both addresses are env-driven so no placeholder address can
 * ship hard-coded; with either unset the whole app runs in PREVIEW — campaigns
 * are recorded but not escrowed, vouchers are computed but not claimable, and
 * every screen says so.
 */
export const contracts = {
  token: envAddress(process.env.NEXT_PUBLIC_CLIPR_TOKEN_ADDRESS),
  escrow: envAddress(process.env.NEXT_PUBLIC_CLIPR_ESCROW_ADDRESS),
  tokenDecimals: 18,
} as const;

export const isLive =
  process.env.NEXT_PUBLIC_CLIPR_LIVE === "true" &&
  contracts.token !== null &&
  contracts.escrow !== null;

export { clipEscrowAbi, clipTokenAbi };

/** EIP-712 domain of the escrow, shared by the server signer and the tests. */
export function escrowDomain(chainId: number, verifyingContract: `0x${string}`) {
  return {
    name: "ClipEscrow",
    version: "1",
    chainId,
    verifyingContract,
  } as const;
}

export const settlementTypes = {
  Settlement: [
    { name: "campaignId", type: "uint256" },
    { name: "submissionId", type: "bytes32" },
    { name: "clipper", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
