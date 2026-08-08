// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SimpleVault} from "../src/SimpleVault.sol";

contract DeploySimpleVault is Script {
    function run() external {
        address owner_ = vm.envOr("VAULT_OWNER", msg.sender);
        vm.startBroadcast();
        SimpleVault vault = new SimpleVault(owner_);
        console2.log("SimpleVault deployed at", address(vault));
        vm.stopBroadcast();
    }
}
