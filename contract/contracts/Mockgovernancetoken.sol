// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockGovernanceToken is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT   = 10 * 10 ** 18;
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

    mapping(address => uint256) public lastClaimed;

    event FaucetClaimed(address indexed to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function faucet() external {
        require(
            block.timestamp >= lastClaimed[msg.sender] + FAUCET_COOLDOWN,
            "Faucet: wait 24h between claims"
        );
        lastClaimed[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    function canClaim(address user) external view returns (bool eligible, uint256 cooldownEndsAt) {
        cooldownEndsAt = lastClaimed[user] + FAUCET_COOLDOWN;
        eligible       = block.timestamp >= cooldownEndsAt;
    }
}