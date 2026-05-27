import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { WagmiAdapter } from "@cofhe/sdk/adapters";
import { chains } from "@cofhe/sdk/chains";
import { Encryptable } from "@cofhe/sdk";
import type { PublicClient, WalletClient } from "viem";

const config = createCofheConfig({ supportedChains: [chains.sepolia] });
let cofheClient: ReturnType<typeof createCofheClient> | null = null;

function getCofheClient() {
  if (!cofheClient) {
    cofheClient = createCofheClient(config);
  }
  return cofheClient;
}

function resetCofheClient() {
  cofheClient = createCofheClient(config);
  return cofheClient;
}

function isStorageHubInitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Iframe storage hub did not initialize") ||
    message.includes("Failed to rehydrate keys store")
  );
}

async function retry<T>(
  action: () => Promise<T>,
  {
    attempts = 2,
    delayMs = 1200,
  }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

export async function connectCofhe(
  publicClient: PublicClient,
  walletClient: WalletClient,
) {
  let client = getCofheClient();
  type AdapterWalletClient = Parameters<typeof WagmiAdapter>[0];
  type AdapterPublicClient = Parameters<typeof WagmiAdapter>[1];
  const { publicClient: pc, walletClient: wc } = await WagmiAdapter(
    walletClient as AdapterWalletClient,
    publicClient as AdapterPublicClient,
  );
  type CofhePublicClient = Parameters<typeof client.connect>[0];
  type CofheWalletClient = Parameters<typeof client.connect>[1];
  try {
    await retry(
      () => client.connect(pc as CofhePublicClient, wc as CofheWalletClient),
      { attempts: 3, delayMs: 1500 },
    );
  } catch (error) {
    if (!isStorageHubInitError(error)) throw error;
    client = resetCofheClient();
    await retry(
      () => client.connect(pc as CofhePublicClient, wc as CofheWalletClient),
      { attempts: 2, delayMs: 1800 },
    );
  }
}

export async function encryptRankings(rankings: number[]) {
  const client = getCofheClient();
  // max 2048 bits per call, uint32 = 32 bits each, so max 64 books per call — we're fine
  const inputs = rankings.map((r) => Encryptable.uint32(BigInt(r)));
  const encrypted = await retry(() => client.encryptInputs(inputs).execute(), {
    attempts: 2,
    delayMs: 1000,
  });
  return encrypted;
}
