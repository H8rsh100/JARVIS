// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SimpleVault} from "../src/SimpleVault.sol";

/// @notice Broadcast-friendly deploy entry without forge-std (set owner via constructor arg tooling).
contract DeploySimpleVaultBare {
    event Deployed(address vault, address owner);

    function deploy(address owner_) external returns (address) {
        SimpleVault vault = new SimpleVault(owner_);
        emit Deployed(address(vault), owner_);
        return address(vault);
    }
}
