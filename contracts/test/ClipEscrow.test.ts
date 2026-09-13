import { expect } from "chai";
import { ethers, network } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { ClipEscrow, ClipToken } from "../typechain-types";

const E = (n: string | number) => ethers.parseEther(String(n));
const DAY = 24 * 60 * 60;
const FEE_BPS = 500; // 5 %

async function now(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return block!.timestamp;
}

async function warp(seconds: number) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine", []);
}

describe("ClipEscrow", () => {
  let owner: HardhatEthersSigner;
  let signer: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let brand: HardhatEthersSigner;
  let clipper: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;
  let token: ClipToken;
  let escrow: ClipEscrow;
  let escrowAddress: string;

  const briefHash = ethers.keccak256(ethers.toUtf8Bytes("brief:1"));
  const subId = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

  /** Sign a settlement voucher the way the platform verifier does. */
  async function voucher(
    who: HardhatEthersSigner,
    campaignId: bigint,
    submissionId: string,
    to: string,
    amount: bigint,
    deadline: number,
  ) {
    const domain = {
      name: "ClipEscrow",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: escrowAddress,
    };
    const types = {
      Settlement: [
        { name: "campaignId", type: "uint256" },
        { name: "submissionId", type: "bytes32" },
        { name: "clipper", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    return who.signTypedData(domain, types, {
      campaignId,
      submissionId,
      clipper: to,
      amount,
      deadline,
    });
  }

  beforeEach(async () => {
    [owner, signer, treasury, brand, clipper, stranger] = await ethers.getSigners();

    token = await (await ethers.getContractFactory("ClipToken")).deploy(1_000_000_000n);
    escrow = await (
      await ethers.getContractFactory("ClipEscrow")
    ).deploy(await token.getAddress(), signer.address, treasury.address, FEE_BPS);
    escrowAddress = await escrow.getAddress();

    await token.transfer(brand.address, E(100_000));
    await token.connect(brand).approve(escrowAddress, ethers.MaxUint256);
  });

  async function fund(budget = E(10_000), days = 30): Promise<bigint> {
    const endsAt = (await now()) + days * DAY;
    await escrow.connect(brand).createCampaign(budget, endsAt, briefHash);
    return (await escrow.nextCampaignId()) - 1n;
  }

  describe("deployment", () => {
    it("wires the token, signer, fee and owner", async () => {
      expect(await escrow.token()).to.equal(await token.getAddress());
      expect(await escrow.signer()).to.equal(signer.address);
      expect(await escrow.feeRecipient()).to.equal(treasury.address);
      expect(await escrow.feeBps()).to.equal(FEE_BPS);
      expect(await escrow.owner()).to.equal(owner.address);
      expect(await token.totalSupply()).to.equal(E(1_000_000_000));
    });

    it("refuses a fee above the cap", async () => {
      const factory = await ethers.getContractFactory("ClipEscrow");
      await expect(
        factory.deploy(await token.getAddress(), signer.address, treasury.address, 1_001),
      ).to.be.revertedWith("ClipEscrow: fee too high");
    });
  });

  describe("createCampaign", () => {
    it("pulls budget + fee, keeps the budget and forwards the fee", async () => {
      const endsAt = (await now()) + 30 * DAY;
      await expect(escrow.connect(brand).createCampaign(E(10_000), endsAt, briefHash))
        .to.emit(escrow, "CampaignCreated")
        .withArgs(1n, brand.address, E(10_000), E(500), endsAt, briefHash);

      expect(await token.balanceOf(escrowAddress)).to.equal(E(10_000));
      expect(await token.balanceOf(treasury.address)).to.equal(E(500));
      expect(await token.balanceOf(brand.address)).to.equal(E(100_000 - 10_500));
      expect(await escrow.totalEscrowed()).to.equal(E(10_000));
      expect(await escrow.totalFees()).to.equal(E(500));
      expect(await escrow.available(1n)).to.equal(E(10_000));

      const c = await escrow.campaigns(1n);
      expect(c.brand).to.equal(brand.address);
      expect(c.endsAt).to.equal(endsAt);
      expect(c.closedAt).to.equal(0n);
      expect(c.budget).to.equal(E(10_000));
      expect(c.spent).to.equal(0n);
      expect(c.briefHash).to.equal(briefHash);
    });

    it("numbers campaigns from 1 upwards", async () => {
      expect(await fund()).to.equal(1n);
      expect(await fund()).to.equal(2n);
    });

    it("rejects a zero budget and a past end date", async () => {
      const endsAt = (await now()) + DAY;
      await expect(
        escrow.connect(brand).createCampaign(0, endsAt, briefHash),
      ).to.be.revertedWith("ClipEscrow: budget is zero");
      await expect(
        escrow.connect(brand).createCampaign(E(1), (await now()) - 1, briefHash),
      ).to.be.revertedWith("ClipEscrow: ends in the past");
    });

    it("fails when the brand has not approved the fee on top", async () => {
      await token.connect(brand).approve(escrowAddress, E(10_000));
      const endsAt = (await now()) + DAY;
      await expect(escrow.connect(brand).createCampaign(E(10_000), endsAt, briefHash)).to.be
        .reverted;
    });
  });

  describe("topUp", () => {
    it("grows the budget and charges the fee again", async () => {
      const id = await fund(E(1_000));
      await expect(escrow.connect(brand).topUp(id, E(2_000)))
        .to.emit(escrow, "ToppedUp")
        .withArgs(id, E(2_000), E(100));
      expect(await escrow.available(id)).to.equal(E(3_000));
      expect(await token.balanceOf(treasury.address)).to.equal(E(50 + 100));
    });

    it("lets anyone top up an open campaign, never a closed one", async () => {
      const id = await fund(E(1_000));
      await token.transfer(stranger.address, E(1_050));
      await token.connect(stranger).approve(escrowAddress, ethers.MaxUint256);
      await escrow.connect(stranger).topUp(id, E(1_000));
      expect(await escrow.available(id)).to.equal(E(2_000));

      await escrow.connect(brand).close(id);
      await expect(escrow.connect(brand).topUp(id, E(1))).to.be.revertedWith(
        "ClipEscrow: campaign closed",
      );
      await expect(escrow.connect(brand).topUp(99n, E(1))).to.be.revertedWith(
        "ClipEscrow: no such campaign",
      );
    });
  });

  describe("settle", () => {
    it("pays the clipper from the budget against a valid voucher", async () => {
      const id = await fund(E(10_000));
      const deadline = (await now()) + DAY;
      const sub = subId("sub:1");
      const amount = E(37.5); // 15,000 views at 2.5 CLIPR per 1K
      const sig = await voucher(signer, id, sub, clipper.address, amount, deadline);

      // Relayed by a third party: the payout still lands with the clipper.
      await expect(escrow.connect(stranger).settle(id, sub, clipper.address, amount, deadline, sig))
        .to.emit(escrow, "Settled")
        .withArgs(id, sub, clipper.address, amount);

      expect(await token.balanceOf(clipper.address)).to.equal(amount);
      expect(await escrow.settled(sub)).to.equal(true);
      expect(await escrow.available(id)).to.equal(E(10_000) - amount);
      expect(await escrow.totalEscrowed()).to.equal(E(10_000) - amount);
      expect(await escrow.totalPaid()).to.equal(amount);
    });

    it("pays a submission only once", async () => {
      const id = await fund();
      const deadline = (await now()) + DAY;
      const sub = subId("sub:once");
      const sig = await voucher(signer, id, sub, clipper.address, E(1), deadline);
      await escrow.settle(id, sub, clipper.address, E(1), deadline, sig);
      await expect(
        escrow.settle(id, sub, clipper.address, E(1), deadline, sig),
      ).to.be.revertedWith("ClipEscrow: already settled");
    });

    it("rejects a voucher signed by anyone but the signer", async () => {
      const id = await fund();
      const deadline = (await now()) + DAY;
      const sub = subId("sub:forged");
      const sig = await voucher(brand, id, sub, clipper.address, E(1), deadline);
      await expect(
        escrow.settle(id, sub, clipper.address, E(1), deadline, sig),
      ).to.be.revertedWith("ClipEscrow: bad signature");
    });

    it("rejects a voucher whose fields were altered after signing", async () => {
      const id = await fund();
      const deadline = (await now()) + DAY;
      const sub = subId("sub:tampered");
      const sig = await voucher(signer, id, sub, clipper.address, E(1), deadline);
      // More money.
      await expect(
        escrow.settle(id, sub, clipper.address, E(2), deadline, sig),
      ).to.be.revertedWith("ClipEscrow: bad signature");
      // Different recipient.
      await expect(
        escrow.settle(id, sub, stranger.address, E(1), deadline, sig),
      ).to.be.revertedWith("ClipEscrow: bad signature");
      // Different campaign (funded, so the campaign check passes first).
      const other = await fund();
      await expect(
        escrow.settle(other, sub, clipper.address, E(1), deadline, sig),
      ).to.be.revertedWith("ClipEscrow: bad signature");
    });

    it("rejects an expired voucher", async () => {
      const id = await fund();
      const deadline = (await now()) + 60;
      const sub = subId("sub:late");
      const sig = await voucher(signer, id, sub, clipper.address, E(1), deadline);
      await warp(120);
      await expect(
        escrow.settle(id, sub, clipper.address, E(1), deadline, sig),
      ).to.be.revertedWith("ClipEscrow: voucher expired");
    });

    it("never pays beyond the budget, even with a valid signature", async () => {
      const id = await fund(E(100));
      const deadline = (await now()) + DAY;
      const a = subId("sub:a");
      const b = subId("sub:b");
      const sigA = await voucher(signer, id, a, clipper.address, E(80), deadline);
      const sigB = await voucher(signer, id, b, clipper.address, E(30), deadline);
      await escrow.settle(id, a, clipper.address, E(80), deadline, sigA);
      await expect(
        escrow.settle(id, b, clipper.address, E(30), deadline, sigB),
      ).to.be.revertedWith("ClipEscrow: budget exhausted");
      // Exactly the remainder is fine.
      const sigC = await voucher(signer, id, b, clipper.address, E(20), deadline);
      await escrow.settle(id, b, clipper.address, E(20), deadline, sigC);
      expect(await escrow.available(id)).to.equal(0n);
    });

    it("rejects unknown campaigns, zero amounts and zero recipients", async () => {
      const id = await fund();
      const deadline = (await now()) + DAY;
      const sub = subId("sub:z");
      const sig = await voucher(signer, id, sub, clipper.address, E(1), deadline);
      await expect(
        escrow.settle(42n, sub, clipper.address, E(1), deadline, sig),
      ).to.be.revertedWith("ClipEscrow: no such campaign");
      await expect(
        escrow.settle(id, sub, clipper.address, 0, deadline, sig),
      ).to.be.revertedWith("ClipEscrow: amount is zero");
      await expect(
        escrow.settle(id, sub, ethers.ZeroAddress, E(1), deadline, sig),
      ).to.be.revertedWith("ClipEscrow: clipper is zero");
    });
  });

  describe("close and withdraw", () => {
    it("only the brand can close, and only once", async () => {
      const id = await fund();
      await expect(escrow.connect(stranger).close(id)).to.be.revertedWith(
        "ClipEscrow: not the brand",
      );
      await expect(escrow.connect(brand).close(id)).to.emit(escrow, "Closed");
      await expect(escrow.connect(brand).close(id)).to.be.revertedWith(
        "ClipEscrow: already closed",
      );
    });

    it("keeps honouring vouchers during the grace period, then lets the brand withdraw", async () => {
      const id = await fund(E(1_000));
      const deadline = (await now()) + 10 * DAY;
      const sub = subId("sub:grace");
      const sig = await voucher(signer, id, sub, clipper.address, E(250), deadline);

      await escrow.connect(brand).close(id);

      // Too early.
      await expect(escrow.connect(brand).withdraw(id)).to.be.revertedWith(
        "ClipEscrow: grace period running",
      );

      // A voucher earned before closure still pays inside the grace period.
      await warp(3 * DAY);
      await escrow.settle(id, sub, clipper.address, E(250), deadline, sig);
      expect(await token.balanceOf(clipper.address)).to.equal(E(250));

      await warp(4 * DAY + 1);
      const before = await token.balanceOf(brand.address);
      await expect(escrow.connect(brand).withdraw(id))
        .to.emit(escrow, "Withdrawn")
        .withArgs(id, E(750));
      expect((await token.balanceOf(brand.address)) - before).to.equal(E(750));
      expect(await escrow.available(id)).to.equal(0n);
      expect(await escrow.totalEscrowed()).to.equal(0n);
      expect(await token.balanceOf(escrowAddress)).to.equal(0n);

      // Nothing left, and a late voucher cannot dig into it.
      await expect(escrow.connect(brand).withdraw(id)).to.be.revertedWith(
        "ClipEscrow: nothing to withdraw",
      );
      const late = subId("sub:late-voucher");
      const sigLate = await voucher(signer, id, late, clipper.address, E(1), deadline);
      await expect(
        escrow.settle(id, late, clipper.address, E(1), deadline, sigLate),
      ).to.be.revertedWith("ClipEscrow: campaign settled out");
    });

    it("refuses withdrawal from an open campaign or by a stranger", async () => {
      const id = await fund();
      await expect(escrow.connect(brand).withdraw(id)).to.be.revertedWith(
        "ClipEscrow: not closed",
      );
      await escrow.connect(brand).close(id);
      await warp(8 * DAY);
      await expect(escrow.connect(stranger).withdraw(id)).to.be.revertedWith(
        "ClipEscrow: not the brand",
      );
    });
  });

  describe("admin", () => {
    it("rotates the signer — old vouchers stop working, new ones start", async () => {
      const id = await fund();
      const deadline = (await now()) + DAY;
      const sub = subId("sub:rotate");
      const oldSig = await voucher(signer, id, sub, clipper.address, E(1), deadline);

      await expect(escrow.connect(stranger).setSigner(stranger.address)).to.be.revertedWithCustomError(
        escrow,
        "OwnableUnauthorizedAccount",
      );
      await expect(escrow.setSigner(ethers.ZeroAddress)).to.be.revertedWith(
        "ClipEscrow: signer is zero",
      );
      await expect(escrow.setSigner(stranger.address))
        .to.emit(escrow, "SignerChanged")
        .withArgs(signer.address, stranger.address);

      await expect(
        escrow.settle(id, sub, clipper.address, E(1), deadline, oldSig),
      ).to.be.revertedWith("ClipEscrow: bad signature");
      const newSig = await voucher(stranger, id, sub, clipper.address, E(1), deadline);
      await escrow.settle(id, sub, clipper.address, E(1), deadline, newSig);
    });

    it("changes the fee for future deposits only, within the cap", async () => {
      await fund(E(1_000)); // 5 % → 50
      await expect(escrow.setFee(stranger.address, 1_001)).to.be.revertedWith(
        "ClipEscrow: fee too high",
      );
      await expect(escrow.setFee(stranger.address, 200))
        .to.emit(escrow, "FeeChanged")
        .withArgs(stranger.address, 200);
      expect(await escrow.feeOn(E(1_000))).to.equal(E(20));
      await fund(E(1_000)); // 2 % → 20, to the new recipient
      expect(await token.balanceOf(treasury.address)).to.equal(E(50));
      expect(await token.balanceOf(stranger.address)).to.equal(E(20));
    });

    it("gives the owner no way to touch campaign funds", async () => {
      await fund(E(5_000));
      const iface = escrow.interface;
      const names = iface.fragments
        .filter((f) => f.type === "function")
        .map((f) => (f as unknown as { name: string }).name);
      for (const n of names) {
        expect(n).to.not.match(/rescue|sweep|emergency|drain/i);
      }
      // And the accounting matches the balance to the wei.
      expect(await token.balanceOf(escrowAddress)).to.equal(await escrow.totalEscrowed());
    });
  });
});
