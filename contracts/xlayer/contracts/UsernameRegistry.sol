// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract UsernameRegistry {
    address public immutable verifier;
    mapping(string => address) public handleToAddress;
    mapping(address => string) public addressToHandle;
    mapping(bytes32 => bool) public usedNonces;

    event HandleRegistered(address indexed wallet, string handle, bytes32 indexed nonce);

    constructor(address verifier_) {
        require(verifier_ != address(0), "invalid verifier");
        verifier = verifier_;
    }

    function register(
        string calldata handle,
        uint256 expiresAt,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        string memory canonical = normalizeHandle(handle);
        require(expiresAt >= block.timestamp, "attestation expired");
        require(!usedNonces[nonce], "attestation used");
        require(bytes(addressToHandle[msg.sender]).length == 0, "wallet already registered");
        require(handleToAddress[canonical] == address(0), "handle taken");

        bytes32 digest = keccak256(
            abi.encode(address(this), block.chainid, msg.sender, keccak256(bytes(canonical)), nonce, expiresAt)
        );
        require(_recover(_ethSignedMessageHash(digest), signature) == verifier, "invalid attestation");

        usedNonces[nonce] = true;
        handleToAddress[canonical] = msg.sender;
        addressToHandle[msg.sender] = canonical;
        emit HandleRegistered(msg.sender, canonical, nonce);
    }

    function resolve(string calldata handle) external view returns (address) {
        return handleToAddress[normalizeHandle(handle)];
    }

    function normalizeHandle(string memory handle) public pure returns (string memory) {
        bytes memory input = bytes(handle);
        uint256 start = input.length > 0 && input[0] == bytes1("@") ? 1 : 0;
        uint256 length = input.length - start;
        require(length > 0 && length <= 15, "invalid handle length");

        bytes memory output = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            bytes1 char = input[i + start];
            require(
                (char >= bytes1("a") && char <= bytes1("z")) ||
                (char >= bytes1("A") && char <= bytes1("Z")) ||
                (char >= bytes1("0") && char <= bytes1("9")) ||
                char == bytes1("_"),
                "invalid handle"
            );
            if (char >= bytes1("A") && char <= bytes1("Z")) char = bytes1(uint8(char) + 32);
            output[i] = char;
        }
        return string(output);
    }

    function _ethSignedMessageHash(bytes32 digest) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        require(signature.length == 65, "invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "invalid signature v");
        require(uint256(s) <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0, "invalid signature s");
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "invalid signature");
        return signer;
    }
}
