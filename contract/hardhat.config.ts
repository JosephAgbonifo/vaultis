import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
    },
  },
  networks: {
    baseSepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: [process.env.PRIVATE_KEY!],
    },
    coston2: {
      url: "https://coston2-api.flare.network/ext/C/rpc",
      chainId: 114,
      accounts: [process.env.PRIVATE_KEY!],
    },
    sepolia: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts: [process.env.PRIVATE_KEY!],
    },
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
};

export default config;
