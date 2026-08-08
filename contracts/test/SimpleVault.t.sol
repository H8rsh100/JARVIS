// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SimpleVault} from "../src/SimpleVault.sol";

contract SimpleVaultTestLite {
    function probe() external {
        SimpleVault v = new SimpleVault(address(this));
        require(v.owner() == address(this), "owner");
    }
}
