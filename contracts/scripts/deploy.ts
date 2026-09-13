import { ethers, network } from "hardhat";

/**
 * Deploys the escrow, and the token too unless TOKEN_ADDRESS points at an
 * existing ERC-20 (the coin launched elsewhere).
 *
 * Env:
 *   TOKEN_ADDRESS   optional — reuse an existing token
 *   TOKEN_SUPPLY    whole tokens to mint if deploying ClipToken (default 1e9)
 *   SIGNER_ADDRESS  the verifier's address (the app's SETTLEMENT_SIGNER_KEY)
 *   FEE_RECIPIENT   treasury or burn address (default: deployer)
 *   FEE_BPS         platform fee in basis points (default 500)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`network      ${network.name}`);
  console.log(`deployer     ${deployer.address}`);

  let tokenAddress = process.env.TOKEN_ADDRESS?.trim();
  if (!tokenAddress) {
    const supply = BigInt(process.env.TOKEN_SUPPLY ?? "1000000000");
    const token = await (await ethers.getContractFactory("ClipToken")).deploy(supply);
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
    console.log(`ClipToken    ${tokenAddress} (supply ${supply})`);
  } else {
    console.log(`token        ${tokenAddress} (existing)`);
  }

  const signer = process.env.SIGNER_ADDRESS?.trim();
  if (!signer) throw new Error("SIGNER_ADDRESS is required — the app's voucher signer");
  const feeRecipient = process.env.FEE_RECIPIENT?.trim() || deployer.address;
  const feeBps = Number(process.env.FEE_BPS ?? 500);

  const escrow = await (
    await ethers.getContractFactory("ClipEscrow")
  ).deploy(tokenAddress, signer, feeRecipient, feeBps);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`ClipEscrow   ${escrowAddress} (signer ${signer}, fee ${feeBps} bps → ${feeRecipient})`);

  console.log("\nPaste into the web app's .env.local:");
  console.log(`NEXT_PUBLIC_CLIPR_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_CLIPR_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`NEXT_PUBLIC_CLIPR_LIVE=true`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
