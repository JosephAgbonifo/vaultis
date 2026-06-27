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

// ─── encryptVoteWeight ────────────────────────────────────────────────────────
// One InEuint64 pair per proposal, matching Vaultis.castBallot's signature.
//
// tokenBalance is the caller's raw balanceOf (in wei). We divide by 1e18
// before encrypting so the FHE tally stays within uint64 range — two voters
// at 10 VLTG each would produce 20e18 raw which overflows uint64
// (max ≈ 18.4e18) and silently corrupts the tally.

export async function encryptVoteWeight(
  forChoice: boolean,
  tokenBalance: bigint
): Promise<{
  forWeight: any;
  againstWeight: any;
}> {
  if (typeof window === "undefined") {
    return { forWeight: undefined, againstWeight: undefined };
  }

  // Convert from wei to whole tokens to stay within uint64 range.
  const voteWeight = tokenBalance / BigInt(1e18);

  console.log("encryptVoteWeight", { forChoice, tokenBalance, voteWeight });

  if (voteWeight <= 0n) {
    throw new Error("Cannot vote with zero token balance");
  }

  const { client, Encryptable } = await getCachedClient();

  const inputs = [
    Encryptable.uint64(forChoice ? voteWeight : 0n),
    Encryptable.uint64(forChoice ? 0n : voteWeight),
  ];

  // Bind ciphertexts to VAULTIS_ADDRESS so the contract's FHE.asEuint64()
  // call doesn't throw InvalidSigner.
  const encrypted = await client
    .encryptInputs(inputs, VAULTIS_ADDRESS)
    .execute();

  return {
    forWeight: encrypted[0],
    againstWeight: encrypted[1],
  };
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
