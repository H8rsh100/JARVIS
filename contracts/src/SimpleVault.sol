// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SimpleVault — demo contract for JARVIS voice deploys
contract SimpleVault {
    address public owner;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error NotOwner();

    constructor(address owner_) {
        owner = owner_;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function deposit() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        (bool ok, ) = payable(owner).call{value: amount}("");
        require(ok, "transfer failed");
        emit Withdrawn(owner, amount);
    }
}
