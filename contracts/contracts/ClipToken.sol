// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ClipToken
/// @notice The campaign currency: a plain fixed-supply ERC-20. Every campaign
///         budget is deposited in it and every clipper is paid in it.
/// @dev Deliberately boring — no tax, no owner, no mint. If the coin is
///      launched elsewhere (a launchpad curve, say), `ClipEscrow` takes any
///      ERC-20 in its constructor and this file is simply not deployed.
contract ClipToken is ERC20 {
    /// @param supply Whole tokens; scaled by `decimals()` here.
    constructor(uint256 supply) ERC20("CLIPR", "CLIPR") {
        _mint(msg.sender, supply * 10 ** decimals());
    }
}
