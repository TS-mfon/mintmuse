// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CreatorCoin.sol";
import "./UsernameRegistry.sol";

/// @title CreatorCoinFactory
/// @notice Deploys a CreatorCoin per handle. Requires the deployer to have
///         already bound their handle in the UsernameRegistry.
contract CreatorCoinFactory {
    UsernameRegistry public immutable registry;
    address[] public allCoins;
    mapping(string => address) public handleToCoin;

    event CoinCreated(
        address indexed creator,
        string handle,
        address coin,
        string name,
        string symbol
    );

    constructor(address registry_) {
        registry = UsernameRegistry(registry_);
    }

    function createCoin(
        string calldata handle,
        string calldata name_,
        string calldata symbol_,
        string calldata artUri_
    ) external returns (address) {
        require(bytes(registry.addressToHandle(msg.sender)).length > 0, "register handle first");
        require(handleToCoin[handle] == address(0), "coin exists for handle");

        CreatorCoin coin = new CreatorCoin(name_, symbol_, handle, artUri_, msg.sender);
        address c = address(coin);
        allCoins.push(c);
        handleToCoin[handle] = c;
        emit CoinCreated(msg.sender, handle, c, name_, symbol_);
        return c;
    }

    function totalCoins() external view returns (uint256) {
        return allCoins.length;
    }
}
