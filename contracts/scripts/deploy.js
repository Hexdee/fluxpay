const { ethers } = require("hardhat");

async function main() {
  const token = process.env.USDT0_ADDRESS;
  const signer = process.env.SIGNER_ADDRESS;
  if (!token || !signer) {
    throw new Error("Missing USDT0_ADDRESS or SIGNER_ADDRESS in env");
  }

  const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");
  const contract = await PaymentProcessor.deploy(token, signer);
  await contract.waitForDeployment();

  // eslint-disable-next-line no-console
  console.log("PaymentProcessor deployed to:", await contract.getAddress());
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

