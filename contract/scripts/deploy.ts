import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const TOTAL_SUPPLY = ethers.parseUnits(
    process.env.GOVERNANCE_TOTAL_SUPPLY ?? "1000000",
    18
  );

  // ── Governance token (fixed supply) ───────────────────────────────────────
  console.log("\nDeploying MockGovernanceToken (fixed supply)...");
  const MockToken = await ethers.getContractFactory("MockGovernanceToken");
  const token = await MockToken.deploy(
    "Vaultis Governance",
    "VLTG",
    TOTAL_SUPPLY
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("MockGovernanceToken deployed to:", tokenAddress);
  console.log(
    "Total supply (fixed, no further minting):",
    ethers.formatUnits(TOTAL_SUPPLY, 18)
  );

  // ── Deploy Vaultis ────────────────────────────────────────────────────────
  const Vaultis = await ethers.getContractFactory("Vaultis");
  const vaultis = await Vaultis.deploy(tokenAddress);
  await vaultis.waitForDeployment();
  const vaultisAddress = await vaultis.getAddress();
  console.log("\nVaultis deployed to:", vaultisAddress);

  // ── Fund the treasury ─────────────────────────────────────────────────────
  // Whole fixed supply moves into Vaultis. From here on, every faucet claim
  // and every approved proposal payout draws down this same balance.
  console.log("\nFunding treasury — transferring full supply into Vaultis...");
  const fundTx = await token.transfer(vaultisAddress, TOTAL_SUPPLY);
  await fundTx.wait();

  const treasuryBalance = await vaultis.treasuryBalance();
  console.log(
    "Treasury balance:",
    ethers.formatUnits(treasuryBalance, 18),
    "VLTG"
  );

  // ── Deploy VaultisLens ────────────────────────────────────────────────────
  console.log("\nDeploying VaultisLens...");
  const VaultisLens = await ethers.getContractFactory("VaultisLens");
  const lens = await VaultisLens.deploy(vaultisAddress);
  await lens.waitForDeployment();
  const lensAddress = await lens.getAddress();
  console.log("VaultisLens deployed to:", lensAddress);

  console.log("\n─────────────────────────────────────────────────────");
  console.log("Add to .env.local:");
  console.log(`NEXT_PUBLIC_VAULTIS_ADDRESS=${vaultisAddress}`);
  console.log(`NEXT_PUBLIC_VAULTIS_LENS_ADDRESS=${lensAddress}`);
  console.log(`NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS=${tokenAddress}`);
  console.log("─────────────────────────────────────────────────────");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
