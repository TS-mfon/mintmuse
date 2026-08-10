// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CreatorCoin.sol";
import "./UsernameRegistry.sol";

contract CreatorCoinFactory {
    UsernameRegistry public immutable registry;
    address public immutable feeRecipient;
    address[] public allCoins;
    mapping(string => address) public handleToCoin;

    event CoinCreated(
        address indexed creator,
        string handle,
        address coin,
        string name,
        string symbol
    );

    constructor(address registry_, address feeRecipient_) {
        require(registry_ != address(0) && feeRecipient_ != address(0), "invalid address");
        registry = UsernameRegistry(registry_);
        feeRecipient = feeRecipient_;
    }

    function createCoin(
        string calldata handle,
        string calldata name_,
        string calldata symbol_,
        string calldata artUri_
    ) external returns (address) {
        string memory canonical = registry.normalizeHandle(handle);
        require(
            keccak256(bytes(registry.addressToHandle(msg.sender))) == keccak256(bytes(canonical)),
            "handle mismatch"
        );
        require(handleToCoin[canonical] == address(0), "coin exists for handle");
        require(bytes(name_).length > 0 && bytes(name_).length <= 28, "invalid name");
        require(bytes(symbol_).length >= 3 && bytes(symbol_).length <= 5, "invalid symbol");
        require(bytes(artUri_).length > 0, "invalid art uri");

        CreatorCoin coin = new CreatorCoin(name_, symbol_, canonical, artUri_, msg.sender, feeRecipient);
        address coinAddress = address(coin);
        allCoins.push(coinAddress);
        handleToCoin[canonical] = coinAddress;
        emit CoinCreated(msg.sender, canonical, coinAddress, name_, symbol_);
        return coinAddress;
    }

    function totalCoins() external view returns (uint256) {
        return allCoins.length;
    }
}
