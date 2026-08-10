const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const verifier = process.env.VERIFIER_ADDRESS || deployer.address;
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;

  const Registry = await hre.ethers.getContractFactory("UsernameRegistry");
  const registry = await Registry.deploy(verifier);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("UsernameRegistry:", registryAddr);

  const Factory = await hre.ethers.getContractFactory("CreatorCoinFactory");
  const factory = await Factory.deploy(registryAddr, feeRecipient);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("CreatorCoinFactory:", factoryAddr);

  console.log("\nAdd these to your Vercel env:");
  console.log("NEXT_PUBLIC_REGISTRY_ADDRESS=" + registryAddr);
  console.log("NEXT_PUBLIC_FACTORY_ADDRESS=" + factoryAddr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
