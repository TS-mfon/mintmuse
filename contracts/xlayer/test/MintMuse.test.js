const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

async function attestation(registry, verifier, wallet, handle, nonce, expiresAt) {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const digest = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "address", "bytes32", "bytes32", "uint256"],
    [await registry.getAddress(), chainId, wallet.address, ethers.keccak256(ethers.toUtf8Bytes(handle)), nonce, expiresAt]
  ));
  return verifier.signMessage(ethers.getBytes(digest));
}

async function expectRevert(promise, message) {
  try { await promise; assert.fail("expected transaction to revert"); }
  catch (error) { if (message) assert.match(String(error), new RegExp(message)); }
}

describe("MintMuse contracts", function () {
  async function fixture() {
    const [, verifier, creator, , feeRecipient] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("UsernameRegistry");
    const registry = await Registry.deploy(verifier.address);
    const Factory = await ethers.getContractFactory("CreatorCoinFactory");
    const factory = await Factory.deploy(await registry.getAddress(), feeRecipient.address);
    return { verifier, creator, feeRecipient, registry, factory };
  }

  it("normalizes handles and prevents attestation replay", async function () {
    const { verifier, creator, registry } = await fixture();
    assert.equal(await registry.normalizeHandle("@Alice_1"), "alice_1");
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    const signature = await attestation(registry, verifier, creator, "alice_1", nonce, expiresAt);
    await registry.connect(creator).register("@Alice_1", expiresAt, nonce, signature);
    assert.equal(await registry.addressToHandle(creator.address), "alice_1");
    await expectRevert(registry.connect(creator).register("alice_1", expiresAt, nonce, signature));
  });

  it("prevents a registered wallet from squatting another handle", async function () {
    const { verifier, creator, registry, factory } = await fixture();
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    const signature = await attestation(registry, verifier, creator, "alice", nonce, expiresAt);
    await registry.connect(creator).register("alice", expiresAt, nonce, signature);
    await expectRevert(factory.connect(creator).createCoin("bob", "Bob Coin", "BOB", "https://example.com/bob"), "handle mismatch");
  });

  it("emits the deployed coin address and enforces curve protections", async function () {
    const { verifier, creator, feeRecipient, registry, factory } = await fixture();
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    const signature = await attestation(registry, verifier, creator, "alice", nonce, expiresAt);
    await registry.connect(creator).register("alice", expiresAt, nonce, signature);
    const receipt = await (await factory.connect(creator).createCoin("alice", "Alice Coin", "ALIC", "https://example.com/alice")).wait();
    const event = receipt.logs.map((log) => { try { return factory.interface.parseLog(log); } catch { return null; } }).find((log) => log?.name === "CoinCreated");
    assert.ok(ethers.isAddress(event.args.coin));
    const coin = await ethers.getContractAt("CreatorCoin", event.args.coin);
    const deadline = Math.floor(Date.now() / 1000) + 600;
    await expectRevert(coin.connect(creator).buy(ethers.MaxUint256, deadline, { value: ethers.parseEther("1") }), "slippage");
    await coin.connect(creator).buy(0, deadline, { value: ethers.parseEther("1") });
    const balance = await coin.balanceOf(creator.address);
    await expectRevert(coin.connect(creator).sell(balance, ethers.MaxUint256, deadline), "slippage");
    await coin.connect(creator).sell(balance / 2n, 0, deadline);
    assert.ok((await coin.accruedFees()) > 0n);
    await expectRevert(coin.connect(creator).withdrawFees(), "not fee recipient");
    await coin.connect(feeRecipient).withdrawFees();
  });
});
