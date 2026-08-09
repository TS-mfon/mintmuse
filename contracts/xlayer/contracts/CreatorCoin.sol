// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title CreatorCoin
/// @notice A fair-launch creator token with a constant-product bonding curve.
///         Buying mints tokens and pushes the price up; selling burns and
///         pushes it down. All collateral (native OKB) is held in the contract.
contract CreatorCoin is ERC20 {
    address public immutable creator;
    string public handle;
    string public artUri;

    // Virtual reserves give the curve a starting price without real liquidity.
    uint256 public reserveToken; // virtual token side (1e18)
    uint256 public reserveEth;   // virtual collateral side (wei)
    uint256 public constant INITIAL_VIRTUAL_TOKEN = 1_000_000 * 1e18;
    uint256 public constant INITIAL_VIRTUAL_ETH = 30 ether;
    uint256 public constant FEE_BPS = 100; // 1% protocol fee

    event Buy(address indexed user, uint256 ethIn, uint256 tokensOut, uint256 price);
    event Sell(address indexed user, uint256 tokensIn, uint256 ethOut, uint256 price);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory handle_,
        string memory artUri_,
        address creator_
    ) ERC20(name_, symbol_) {
        creator = creator_;
        handle = handle_;
        artUri = artUri_;
        reserveToken = INITIAL_VIRTUAL_TOKEN;
        reserveEth = INITIAL_VIRTUAL_ETH;
    }

    /// @notice Current price in wei per whole token (scaled by 1e18).
    function price() public view returns (uint256) {
        return (reserveEth * 1e18) / reserveToken;
    }

    /// @notice Buy tokens with native OKB.
    function buy() external payable {
        require(msg.value > 0, "no eth");
        uint256 fee = (msg.value * FEE_BPS) / 10000;
        uint256 ethIn = msg.value - fee;
        uint256 tokensOut = (reserveToken * ethIn) / (reserveEth + ethIn);
        require(tokensOut > 0, "zero out");

        reserveEth += msg.value;
        reserveToken -= tokensOut;
        _mint(msg.sender, tokensOut);
        emit Buy(msg.sender, msg.value, tokensOut, price());
    }

    /// @notice Sell tokens back for native OKB.
    function sell(uint256 tokensIn) external {
        require(tokensIn > 0, "zero in");
        uint256 ethOut = (reserveEth * tokensIn) / (reserveToken + tokensIn);
        uint256 fee = (ethOut * FEE_BPS) / 10000;
        ethOut -= fee;
        require(address(this).balance >= ethOut, "insufficient liquidity");

        reserveToken += tokensIn;
        reserveEth -= ethOut;
        _burn(msg.sender, tokensIn);
        (bool ok, ) = msg.sender.call{ value: ethOut }("");
        require(ok, "transfer failed");
        emit Sell(msg.sender, tokensIn, ethOut, price());
    }

    function getInfo()
        external
        view
        returns (address, string memory, string memory, uint256, uint256, uint256)
    {
        return (creator, handle, artUri, price(), totalSupply(), address(this).balance);
    }
}
