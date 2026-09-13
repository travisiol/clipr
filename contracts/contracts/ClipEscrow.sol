// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ClipEscrow
/// @notice Holds every campaign budget in CLIPR and pays clippers out of it,
///         one settlement per submission, against a voucher signed by the
///         platform's verifier.
/// @dev The division of labour is deliberate and narrow:
///
///        * the chain cannot read TikTok. Which clip earned how many views,
///          whether it followed the brief, and therefore how much it is owed
///          (`views / 1000 * rate`, capped by the campaign's max payout) is
///          decided off chain and signed by `signer`;
///        * what the chain *does* guarantee is the part a clipper cannot
///          verify by looking at a website: the budget was really deposited,
///          it cannot be spent twice, a submission is paid at most once, and
///          the brand cannot pull the money back while vouchers are still
///          being honoured.
///
///      The platform fee is charged on top of the budget at deposit time and
///      forwarded immediately, so the whole `budget` figure is available to
///      clippers. There is no owner path to campaign funds: the owner can
///      rotate the signer and change the fee for *future* deposits, nothing
///      else.
///
///      Reverts are strings on purpose — the app surfaces them verbatim.
contract ClipEscrow is Ownable, EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ───────────────────────────── constants ─────────────────────────────

    /// @notice EIP-712 type hash of a settlement voucher.
    bytes32 public constant SETTLEMENT_TYPEHASH =
        keccak256(
            "Settlement(uint256 campaignId,bytes32 submissionId,address clipper,uint256 amount,uint256 deadline)"
        );

    /// @notice How long a closed campaign keeps honouring vouchers before the
    ///         brand may withdraw what is left. Vouchers are dated, so this is
    ///         also the longest a clipper can sit on one.
    uint256 public constant GRACE_PERIOD = 7 days;

    /// @notice Hard cap on the platform fee, in basis points (10 %).
    uint16 public constant MAX_FEE_BPS = 1_000;

    // ─────────────────────────────── types ───────────────────────────────

    struct Campaign {
        /// The wallet that funded it and the only one that can close it.
        address brand;
        /// Informational end date from the brief; closure is always explicit.
        uint64 endsAt;
        /// Timestamp of `close`, 0 while the campaign is open.
        uint64 closedAt;
        /// CLIPR deposited for clippers, net of the fee. Only ever grows
        /// (top-ups) until `withdraw` collapses it onto `spent`.
        uint256 budget;
        /// CLIPR paid out so far.
        uint256 spent;
        /// keccak256 of the off-chain brief, so the app record and the
        /// escrow can be tied together after the fact.
        bytes32 briefHash;
    }

    // ──────────────────────────────── state ──────────────────────────────

    /// @notice The campaign currency. Every deposit and payout is in it.
    IERC20 public immutable token;
    /// @notice The verifier. Anything it signs within budget is payable.
    address public signer;
    /// @notice Where the platform fee goes — a treasury or a burn address.
    address public feeRecipient;
    /// @notice Platform fee on every deposit, in basis points.
    uint16 public feeBps;

    uint256 public nextCampaignId = 1;
    mapping(uint256 campaignId => Campaign) public campaigns;
    /// @notice Submissions that have been paid. The replay defence.
    mapping(bytes32 submissionId => bool) public settled;

    /// @notice CLIPR currently held for clippers across all campaigns.
    uint256 public totalEscrowed;
    /// @notice CLIPR ever paid to clippers by this contract.
    uint256 public totalPaid;
    /// @notice CLIPR ever forwarded to `feeRecipient`.
    uint256 public totalFees;

    // ─────────────────────────────── events ──────────────────────────────

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed brand,
        uint256 budget,
        uint256 fee,
        uint64 endsAt,
        bytes32 briefHash
    );
    event ToppedUp(uint256 indexed campaignId, uint256 amount, uint256 fee);
    event Settled(
        uint256 indexed campaignId,
        bytes32 indexed submissionId,
        address indexed clipper,
        uint256 amount
    );
    event Closed(uint256 indexed campaignId, uint64 closedAt);
    event Withdrawn(uint256 indexed campaignId, uint256 amount);
    event SignerChanged(address indexed previousSigner, address indexed newSigner);
    event FeeChanged(address indexed feeRecipient, uint16 feeBps);

    // ───────────────────────────── constructor ───────────────────────────

    constructor(IERC20 token_, address signer_, address feeRecipient_, uint16 feeBps_)
        Ownable(msg.sender)
        EIP712("ClipEscrow", "1")
    {
        require(address(token_) != address(0), "ClipEscrow: token is zero");
        require(signer_ != address(0), "ClipEscrow: signer is zero");
        require(feeRecipient_ != address(0), "ClipEscrow: fee recipient is zero");
        require(feeBps_ <= MAX_FEE_BPS, "ClipEscrow: fee too high");
        token = token_;
        signer = signer_;
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    // ─────────────────────────────── brands ──────────────────────────────

    /// @notice Fund a new campaign. Pulls `budget + fee` from the caller.
    /// @param budget  CLIPR available to clippers.
    /// @param endsAt  The brief's end date; must be in the future.
    /// @param briefHash keccak256 of the off-chain brief.
    function createCampaign(uint256 budget, uint64 endsAt, bytes32 briefHash)
        external
        nonReentrant
        returns (uint256 campaignId)
    {
        require(budget > 0, "ClipEscrow: budget is zero");
        require(endsAt > block.timestamp, "ClipEscrow: ends in the past");

        campaignId = nextCampaignId++;
        Campaign storage c = campaigns[campaignId];
        c.brand = msg.sender;
        c.endsAt = endsAt;
        c.budget = budget;
        c.briefHash = briefHash;

        uint256 fee = _collect(budget);
        emit CampaignCreated(campaignId, msg.sender, budget, fee, endsAt, briefHash);
    }

    /// @notice Add budget to an open campaign. Anyone may top up; the fee
    ///         applies the same way.
    function topUp(uint256 campaignId, uint256 amount) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.brand != address(0), "ClipEscrow: no such campaign");
        require(c.closedAt == 0, "ClipEscrow: campaign closed");
        require(amount > 0, "ClipEscrow: amount is zero");

        c.budget += amount;
        uint256 fee = _collect(amount);
        emit ToppedUp(campaignId, amount, fee);
    }

    /// @notice Close a campaign. Vouchers keep settling for `GRACE_PERIOD`;
    ///         after that the brand can withdraw what is left.
    function close(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        require(c.brand == msg.sender, "ClipEscrow: not the brand");
        require(c.closedAt == 0, "ClipEscrow: already closed");
        c.closedAt = uint64(block.timestamp);
        emit Closed(campaignId, c.closedAt);
    }

    /// @notice Return the unspent budget to the brand once the grace period
    ///         has run out.
    function withdraw(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.brand == msg.sender, "ClipEscrow: not the brand");
        require(c.closedAt != 0, "ClipEscrow: not closed");
        require(
            block.timestamp >= uint256(c.closedAt) + GRACE_PERIOD,
            "ClipEscrow: grace period running"
        );

        uint256 remaining = c.budget - c.spent;
        require(remaining > 0, "ClipEscrow: nothing to withdraw");

        c.budget = c.spent;
        totalEscrowed -= remaining;
        token.safeTransfer(msg.sender, remaining);
        emit Withdrawn(campaignId, remaining);
    }

    // ────────────────────────────── clippers ─────────────────────────────

    /// @notice Pay a clipper for one submission. Anyone may relay the
    ///         voucher — the payout always goes to `clipper`.
    /// @param amount   What the verifier decided the submission earned.
    /// @param deadline Unix time after which the voucher is void.
    function settle(
        uint256 campaignId,
        bytes32 submissionId,
        address clipper,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.brand != address(0), "ClipEscrow: no such campaign");
        require(clipper != address(0), "ClipEscrow: clipper is zero");
        require(amount > 0, "ClipEscrow: amount is zero");
        require(block.timestamp <= deadline, "ClipEscrow: voucher expired");
        require(!settled[submissionId], "ClipEscrow: already settled");
        require(
            c.closedAt == 0 || block.timestamp < uint256(c.closedAt) + GRACE_PERIOD,
            "ClipEscrow: campaign settled out"
        );
        require(c.spent + amount <= c.budget, "ClipEscrow: budget exhausted");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(SETTLEMENT_TYPEHASH, campaignId, submissionId, clipper, amount, deadline)
            )
        );
        require(ECDSA.recover(digest, signature) == signer, "ClipEscrow: bad signature");

        settled[submissionId] = true;
        c.spent += amount;
        totalEscrowed -= amount;
        totalPaid += amount;

        token.safeTransfer(clipper, amount);
        emit Settled(campaignId, submissionId, clipper, amount);
    }

    // ─────────────────────────────── views ───────────────────────────────

    /// @notice Budget still payable on a campaign.
    function available(uint256 campaignId) external view returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        return c.budget - c.spent;
    }

    /// @notice Fee charged on top of a deposit of `amount`.
    function feeOn(uint256 amount) public view returns (uint256) {
        return (amount * feeBps) / 10_000;
    }

    /// @notice The EIP-712 domain separator, exposed for off-chain signers.
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ─────────────────────────────── admin ───────────────────────────────

    function setSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "ClipEscrow: signer is zero");
        emit SignerChanged(signer, newSigner);
        signer = newSigner;
    }

    /// @notice Change the fee for future deposits. Existing budgets are not
    ///         touched.
    function setFee(address newRecipient, uint16 newFeeBps) external onlyOwner {
        require(newRecipient != address(0), "ClipEscrow: fee recipient is zero");
        require(newFeeBps <= MAX_FEE_BPS, "ClipEscrow: fee too high");
        feeRecipient = newRecipient;
        feeBps = newFeeBps;
        emit FeeChanged(newRecipient, newFeeBps);
    }

    // ────────────────────────────── internal ─────────────────────────────

    /// @dev Pull `amount + fee` from the caller: the budget stays here, the
    ///      fee goes straight on.
    function _collect(uint256 amount) private returns (uint256 fee) {
        fee = feeOn(amount);
        totalEscrowed += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (fee > 0) {
            totalFees += fee;
            token.safeTransferFrom(msg.sender, feeRecipient, fee);
        }
    }
}
