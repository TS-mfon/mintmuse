// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title UsernameRegistry
/// @notice Binds an X/Twitter handle to the wallet that registered it.
///         No database needed — the binding lives entirely on-chain.
contract UsernameRegistry {
    mapping(string => address) public handleToAddress;
    mapping(address => string) public addressToHandle;

    event HandleRegistered(address indexed wallet, string handle);

    /// @notice Bind the caller's wallet to a handle. A handle can only be
    ///         owned by one wallet. The same wallet may re-bind to a new handle.
    function register(string calldata handle) external {
        require(bytes(handle).length > 0, "empty handle");

        address current = handleToAddress[handle];
        require(current == address(0) || current == msg.sender, "handle taken");

        // If the wallet already had a different handle, free it.
        string memory old = addressToHandle[msg.sender];
        if (bytes(old).length > 0 && keccak256(bytes(old)) != keccak256(bytes(handle))) {
            delete handleToAddress[old];
        }

        handleToAddress[handle] = msg.sender;
        addressToHandle[msg.sender] = handle;
        emit HandleRegistered(msg.sender, handle);
    }

    /// @notice Resolve a handle to its owning wallet.
    function resolve(string calldata handle) external view returns (address) {
        return handleToAddress[handle];
    }
}
