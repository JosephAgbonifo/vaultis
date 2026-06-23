import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // ── Governance token ──────────────────────────────────────────────────────
  // Set GOVERNANCE_TOKEN_ADDRESS in env, or deploy a mock ERC-20 for testnet.
  const governanceTokenAddress = process.env.GOVERNANCE_TOKEN_ADDRESS ?? "";

  let tokenAddress = governanceTokenAddress;

  if (!tokenAddress) {
    console.log("\nNo GOVERNANCE_TOKEN_ADDRESS set — deploying mock ERC-20...");
    const MockToken = await ethers.getContractFactory("MockGovernanceToken");
    const mockToken = await MockToken.deploy(
      "Vaultis Governance",
      "VLTG",
      ethers.parseUnits("10000000", 18) // 10M supply
    );
    await mockToken.waitForDeployment();
    tokenAddress = await mockToken.getAddress();
    console.log("MockGovernanceToken deployed to:", tokenAddress);

    // Mint to deployer for testnet use
    console.log("Minting 1M tokens to deployer...");
    const mintTx = await mockToken.mint(
      deployer.address,
      ethers.parseUnits("1000000", 18)
    );
    await mintTx.wait();
  }

  // ── Durations ─────────────────────────────────────────────────────────────
  // Proposal  : window for DAO members to submit allocation proposals
  // Vote      : window for token holders to cast encrypted ballots
  // Veto      : window for multisig owner to veto individual proposals
  //
  // Short for testnet demos. Swap for production:
  //   86400  = 1 day
  //   604800 = 1 week
  const PROPOSAL_DURATION = Number(process.env.PROPOSAL_DURATION ?? 240); // 5 min
  const VOTING_DURATION = Number(process.env.VOTING_DURATION ?? 150); // 5 min
  const VETO_DURATION = Number(process.env.VETO_DURATION ?? 30); // 2 min

  // ── Deploy Vaultis ────────────────────────────────────────────────────────
  const Vaultis = await ethers.getContractFactory("Vaultis");
  const vaultis = await Vaultis.deploy(
    tokenAddress,
    BigInt(PROPOSAL_DURATION),
    BigInt(VOTING_DURATION),
    BigInt(VETO_DURATION)
  );
  await vaultis.waitForDeployment();

  const address = await vaultis.getAddress();
  console.log("\nVaultis deployed to:", address);
  console.log("Owner:              ", deployer.address);
  console.log("Governance token:   ", tokenAddress);

  // ── Deploy VaultisLens ────────────────────────────────────────────────────
  // Stateless read-only companion — keeps view functions off the core
  // contract's bytecode so it stays under the 24KB EVM code-size limit.
  console.log("\nDeploying VaultisLens...");
  const VaultisLens = await ethers.getContractFactory("VaultisLens");
  const lens = await VaultisLens.deploy(address);
  await lens.waitForDeployment();
  const lensAddress = await lens.getAddress();
  console.log("VaultisLens deployed to:", lensAddress);

  // ── Open first cycle ──────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const proposalEnd = now + PROPOSAL_DURATION;
  const voteEnd = proposalEnd + VOTING_DURATION;
  const vetoEnd = voteEnd + VETO_DURATION;

  const CYCLE_LABEL = process.env.CYCLE_LABEL ?? "Vaultis Genesis Cycle";

  console.log("\nOpening genesis cycle...");
  const tx = await vaultis.openCycle(
    CYCLE_LABEL,
    BigInt(proposalEnd),
    BigInt(voteEnd),
    BigInt(vetoEnd)
  );
  await tx.wait();

  console.log(`Label:            "${CYCLE_LABEL}"`);
  console.log(
    `Proposal ends:     ${new Date(proposalEnd * 1000).toISOString()}`
  );
  console.log(`Voting ends:       ${new Date(voteEnd * 1000).toISOString()}`);
  console.log(`Veto ends:         ${new Date(vetoEnd * 1000).toISOString()}`);
  console.log(`Default proposal:  ${PROPOSAL_DURATION}s`);
  console.log(`Default vote:      ${VOTING_DURATION}s`);
  console.log(`Default veto:      ${VETO_DURATION}s`);
  console.log(
    `Quorum:            15% of total supply (hardcoded QUORUM_BPS = 1500)`
  );

  // ── Wire into frontend ────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────────────");
  console.log("Add to .env.local:");
  console.log(`NEXT_PUBLIC_VAULTIS_ADDRESS=${address}`);
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
