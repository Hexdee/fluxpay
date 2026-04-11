const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = process.env.USDT0_ADDRESS;
  const to = process.env.MINT_TO;
  const amount = process.env.MINT_AMOUNT || "1000";
  if (!tokenAddress || !to) {
    throw new Error("Missing USDT0_ADDRESS or MINT_TO in env");
  }

  const token = await ethers.getContractAt("MockUSDT0", tokenAddress);
  const decimals = await token.decimals();
  const units = ethers.parseUnits(String(amount), Number(decimals));
  const tx = await token.mint(to, units);
  await tx.wait();

  // eslint-disable-next-line no-console
  console.log(`Minted ${amount} USDT0 to ${to}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

