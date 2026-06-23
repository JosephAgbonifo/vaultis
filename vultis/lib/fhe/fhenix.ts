import type { PublicClient, WalletClient } from "viem";
import type {
  CofheClient,
  FheTypes as FheTypesType,
  Encryptable as EncryptableType,
} from "@cofhe/sdk";
import { VAULTIS_ADDRESS } from "@/lib/config/contract";

// ─── Module cache ─────────────────────────────────────────────────────────────

let _cached: {
  client: CofheClient;
  WagmiAdapter: any;
  Encryptable: typeof EncryptableType;
  FheTypes: typeof FheTypesType;
} | null = null;

async function getCachedClient() {
  if (typeof window === "undefined") {
    return {
      client: { connect: async () => {}, disconnect: async () => {} } as any,
      WagmiAdapter: async () => ({ publicClient: {}, walletClient: {} }),
      Encryptable: { uint64: () => {} } as any,
      FheTypes: { Uint64: 0 } as any,
    };
  }

  if (_cached) return _cached;

  const [
    { createCofheConfig, createCofheClient },
    { WagmiAdapter },
    { chains },
    { Encryptable, FheTypes },
  ] = await Promise.all([
    import("@cofhe/sdk/web"),
    import("@cofhe/sdk/adapters"),
    import("@cofhe/sdk/chains"),
    import("@cofhe/sdk"),
  ]);

  const config = createCofheConfig({
    supportedChains: [chains.arbSepolia],
    useWorkers: false,
  });

  const client = createCofheClient(config);
  _cached = { client, WagmiAdapter, Encryptable, FheTypes };
  return _cached;
}

// ─── connectCofhe ─────────────────────────────────────────────────────────────

export async function connectCofhe(
  walletClient: WalletClient,
  publicClient: PublicClient
) {
  const { client, WagmiAdapter } = await getCachedClient();
  if (typeof window === "undefined") return client;

  const { publicClient: pc, walletClient: wc } = await WagmiAdapter(
    walletClient as any,
    publicClient as any
  );

  await client.connect(pc as any, wc as any);
  return client;
}

// ─── encryptVoteWeights ───────────────────────────────────────────────────────
// FIXED: pass contractAddress to encryptInputs so the CoFHE relay
// signs ciphertexts for VAULTIS_ADDRESS specifically.
// Without this the signature is bound to the wrong target and the
// contract's FHE.asEuint64() call throws InvalidSigner.

export async function encryptVoteWeights(
  proposalIds: number[],
  forChoices: boolean[],
  tokenBalance: bigint = BigInt(1)
): Promise<{
  forWeights: any[];
  againstWeights: any[];
}> {
  if (typeof window === "undefined") {
    return { forWeights: [], againstWeights: [] };
  }

  if (proposalIds.length !== forChoices.length) {
    throw new Error("proposalIds and forChoices must be the same length");
  }

  const { client, Encryptable } = await getCachedClient();

  // Build flat input array: [for0, against0, for1, against1, ...]
  const inputs: any[] = [];
  for (let i = 0; i < proposalIds.length; i++) {
    const isFor = forChoices[i];
    inputs.push(Encryptable.uint64(isFor ? tokenBalance : BigInt(0)));
    inputs.push(Encryptable.uint64(isFor ? BigInt(0) : tokenBalance));
  }

  // THE FIX: tell the SDK which contract will consume these ciphertexts.
  // The relay embeds this address in the signature — it must match the
  // contract address that calls FHE.asEuint64(), which is VAULTIS_ADDRESS.
  const encrypted = await client
    .encryptInputs(inputs, VAULTIS_ADDRESS)
    .execute();

  // De-interleave back into parallel arrays
  const forWeights: any[] = [];
  const againstWeights: any[] = [];
  for (let i = 0; i < proposalIds.length; i++) {
    forWeights.push(encrypted[i * 2]);
    againstWeights.push(encrypted[i * 2 + 1]);
  }

  return { forWeights, againstWeights };
}

// ─── decryptTally ─────────────────────────────────────────────────────────────

export async function decryptTally(cipherTextHash: string): Promise<bigint> {
  if (typeof window === "undefined") return BigInt(0);

  if (
    !cipherTextHash ||
    cipherTextHash === "0" ||
    cipherTextHash === "0x0" ||
    cipherTextHash === "null" ||
    cipherTextHash === "undefined"
  ) {
    return BigInt(0);
  }

  const { client, FheTypes } = await getCachedClient();

  const result = await client
    .decryptForTx(cipherTextHash, FheTypes.Uint64)
    .withoutPermit()
    .execute();

  if (result === null || result === undefined) {
    throw new Error(
      `FHE decryption returned null for handle ${cipherTextHash}`
    );
  }

  return result.decryptedValue;
}

// ─── decryptTallyPair ─────────────────────────────────────────────────────────

export async function decryptTallyPair(
  forHandle: string,
  againstHandle: string
): Promise<{ forCount: number; againstCount: number }> {
  if (typeof window === "undefined") {
    return { forCount: 0, againstCount: 0 };
  }

  const [forBig, againstBig] = await Promise.all([
    decryptTally(forHandle),
    decryptTally(againstHandle),
  ]);

  return {
    forCount: Number(forBig),
    againstCount: Number(againstBig),
  };
}

// ─── disconnectCofhe ──────────────────────────────────────────────────────────

export async function disconnectCofhe() {
  if (!_cached || typeof window === "undefined") return;
  await _cached.client.disconnect();
}
