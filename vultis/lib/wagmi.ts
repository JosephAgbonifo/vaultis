import { createConfig, http } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

if (!projectId) {
  // Fails loudly in dev rather than silently breaking the WalletConnect modal.
  console.warn(
    "NEXT_PUBLIC_WC_PROJECT_ID =  is not set — get one free at https://cloud.reown.com"
  );
}

export const config = createConfig({
  chains: [arbitrumSepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: projectId ?? "",
      metadata: {
        name: "Vaultis",
        description: "Private DAO treasury governance, encrypted with FHE.",
        url:
          typeof window !== "undefined"
            ? window.location.origin
            : "https://vaultis.app",
        icons: ["https://vaultis.app/logo.png"],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
  },
});
