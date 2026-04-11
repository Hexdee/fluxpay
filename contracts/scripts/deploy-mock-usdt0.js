const { ethers } = require("hardhat");

async function main() {
  const Token = await ethers.getContractFactory("MockUSDT0");
  const token = await Token.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  // eslint-disable-next-line no-console
  console.log("MockUSDT0 deployed to:", address);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
