// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CreatorCoin is ERC20, ReentrancyGuard {
    address public immutable creator;
    address public immutable feeRecipient;
    string public handle;
    string public artUri;

    uint256 public reserveToken;
    uint256 public reserveEth;
    uint256 public accruedFees;
    uint256 public constant INITIAL_VIRTUAL_TOKEN = 1_000_000 * 1e18;
    uint256 public constant INITIAL_VIRTUAL_ETH = 30 ether;
    uint256 public constant FEE_BPS = 100;

    event Buy(address indexed user, uint256 ethIn, uint256 tokensOut, uint256 price);
    event Sell(address indexed user, uint256 tokensIn, uint256 ethOut, uint256 price);
    event FeesWithdrawn(address indexed recipient, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory handle_,
        string memory artUri_,
        address creator_,
        address feeRecipient_
    ) ERC20(name_, symbol_) {
        require(creator_ != address(0) && feeRecipient_ != address(0), "invalid address");
        creator = creator_;
        feeRecipient = feeRecipient_;
        handle = handle_;
        artUri = artUri_;
        reserveToken = INITIAL_VIRTUAL_TOKEN;
        reserveEth = INITIAL_VIRTUAL_ETH;
    }

    function price() public view returns (uint256) {
        return (reserveEth * 1e18) / reserveToken;
    }

    function quoteBuy(uint256 amountIn) public view returns (uint256) {
        uint256 fee = (amountIn * FEE_BPS) / 10_000;
        uint256 netAmount = amountIn - fee;
        return (reserveToken * netAmount) / (reserveEth + netAmount);
    }

    function quoteSell(uint256 tokensIn) public view returns (uint256) {
        uint256 grossOut = (reserveEth * tokensIn) / (reserveToken + tokensIn);
        return grossOut - ((grossOut * FEE_BPS) / 10_000);
    }

    function buy(uint256 minTokensOut, uint256 deadline) external payable nonReentrant {
        require(block.timestamp <= deadline, "expired");
        require(msg.value > 0, "zero input");
        uint256 fee = (msg.value * FEE_BPS) / 10_000;
        uint256 netAmount = msg.value - fee;
        uint256 tokensOut = (reserveToken * netAmount) / (reserveEth + netAmount);
        require(tokensOut > 0 && tokensOut >= minTokensOut, "slippage");

        accruedFees += fee;
        reserveEth += netAmount;
        reserveToken -= tokensOut;
        _mint(msg.sender, tokensOut);
        emit Buy(msg.sender, msg.value, tokensOut, price());
    }

    function sell(uint256 tokensIn, uint256 minEthOut, uint256 deadline) external nonReentrant {
        require(block.timestamp <= deadline, "expired");
        require(tokensIn > 0, "zero input");
        uint256 grossOut = (reserveEth * tokensIn) / (reserveToken + tokensIn);
        uint256 fee = (grossOut * FEE_BPS) / 10_000;
        uint256 netOut = grossOut - fee;
        require(netOut > 0 && netOut >= minEthOut, "slippage");
        require(address(this).balance >= netOut + accruedFees, "insufficient liquidity");

        reserveToken += tokensIn;
        reserveEth -= grossOut;
        accruedFees += fee;
        _burn(msg.sender, tokensIn);
        (bool sent, ) = msg.sender.call{value: netOut}("");
        require(sent, "transfer failed");
        emit Sell(msg.sender, tokensIn, netOut, price());
    }

    function withdrawFees() external nonReentrant {
        require(msg.sender == feeRecipient, "not fee recipient");
        uint256 amount = accruedFees;
        require(amount > 0, "no fees");
        accruedFees = 0;
        (bool sent, ) = feeRecipient.call{value: amount}("");
        require(sent, "transfer failed");
        emit FeesWithdrawn(feeRecipient, amount);
    }

    function getInfo() external view returns (address, string memory, string memory, uint256, uint256, uint256) {
        return (creator, handle, artUri, price(), totalSupply(), address(this).balance - accruedFees);
    }
}
