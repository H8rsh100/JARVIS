// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SimpleVault} from "../src/SimpleVault.sol";

/// @dev Lightweight compile-time smoke check (no forge-std dependency required for build of src).
contract SimpleVaultOwnerCheck {
    function check() external returns (address) {
        SimpleVault v = new SimpleVault(msg.sender);
        return v.owner();
    }
}
