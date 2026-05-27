import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Nomination phase: 1 day (86400 seconds)
  // Voting phase: 1 day (86400 seconds)
  const NOMINATION_DURATION = 86400;
  const VOTING_DURATION = 86400;

  const BookClub = await ethers.getContractFactory("BookClub");
  const bookClub = await BookClub.deploy(NOMINATION_DURATION, VOTING_DURATION);

  await bookClub.waitForDeployment();

  const address = await bookClub.getAddress();
  console.log("BookClub deployed to:", address);
  console.log("Nomination deadline: 24hrs from now");
  console.log("Voting deadline: 48hrs from now");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
