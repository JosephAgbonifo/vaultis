import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  verifyTypedData,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  VAULTIS_LENS_ADDRESS,
  VAULTIS_LENS_ABI,
  GOVERNANCE_TOKEN_ABI,
} from "@/lib/config/contract";

const account = privateKeyToAccount(
  process.env.RELAYER_PRIVATE_KEY as `0x${string}`
);

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: arbitrumSepolia,
  transport: http(process.env.RPC_URL),
});

const DOMAIN = {
  name: "Vaultis",
  version: "1",
  chainId: arbitrumSepolia.id,
  verifyingContract: VAULTIS_ADDRESS,
} as const;

const PROPOSE_TYPES = {
  Propose: [
    { name: "cycleId", type: "uint256" },
    { name: "recipient", type: "address" },
    { name: "token", type: "address" },
    { name: "encAmountHint", type: "uint64" },
    { name: "unlockAt", type: "uint64" },
    { name: "title", type: "string" },
    { name: "rationale", type: "string" },
    { name: "category", type: "uint8" },
  ],
} as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      cycleId,
      recipient,
      token,
      encAmountHint,
      unlockAt,
      title,
      rationale,
      category,
      signature,
      signerAddress,
    } = body;

    if (
      !cycleId ||
      !recipient ||
      token === undefined ||
      encAmountHint === undefined ||
      !unlockAt ||
      !title ||
      !signature ||
      !signerAddress
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      return NextResponse.json(
        { error: "Invalid recipient address" },
        { status: 400 }
      );
    }

    if (
      token !== "0x0000000000000000000000000000000000000000" &&
      !/^0x[0-9a-fA-F]{40}$/.test(token)
    ) {
      return NextResponse.json(
        { error: "Invalid token address" },
        { status: 400 }
      );
    }

    if (typeof category !== "number" || category < 0 || category > 4) {
      return NextResponse.json(
        { error: "category must be 0–4" },
        { status: 400 }
      );
    }

    const unlockAtNum = Number(unlockAt);
    if (unlockAtNum <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: "unlockAt must be in the future" },
        { status: 400 }
      );
    }

    const valid = await verifyTypedData({
      address: signerAddress as Address,
      domain: DOMAIN,
      types: PROPOSE_TYPES,
      primaryType: "Propose",
      message: {
        cycleId: BigInt(cycleId),
        recipient: recipient as Address,
        token: token as Address,
        encAmountHint: BigInt(encAmountHint),
        unlockAt: BigInt(unlockAt),
        title: title.trim(),
        rationale: rationale?.trim() ?? "",
        category: Number(category),
      },
      signature,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // cycleId stays on core contract (plain storage var).
    const onChainCycleId = await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "cycleId",
    });

    if (BigInt(cycleId) !== onChainCycleId) {
      return NextResponse.json({ error: "Cycle ID mismatch" }, { status: 409 });
    }

    // getCurrentPhase moved to VaultisLens.
    const currentPhase = await publicClient.readContract({
      address: VAULTIS_LENS_ADDRESS,
      abi: VAULTIS_LENS_ABI,
      functionName: "getCurrentPhase",
    });

    if (currentPhase !== "Proposal") {
      return NextResponse.json(
        { error: `Not in proposal phase (current: ${currentPhase})` },
        { status: 409 }
      );
    }

    const govTokenAddress = (await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "governanceToken",
    })) as Address;

    const balance = (await publicClient.readContract({
      address: govTokenAddress,
      abi: GOVERNANCE_TOKEN_ABI,
      functionName: "balanceOf",
      args: [signerAddress as Address],
    })) as bigint;

    if (balance === 0n) {
      return NextResponse.json(
        { error: "Signer holds no governance tokens" },
        { status: 403 }
      );
    }

    const hash = await walletClient.writeContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "submitProposal",
      args: [
        recipient as Address,
        token as Address,
        BigInt(encAmountHint),
        BigInt(unlockAt),
        title.trim(),
        rationale?.trim() ?? "",
        category,
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({ success: true, txHash: hash }, { status: 200 });
  } catch (err: any) {
    console.error("[relay/propose]", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
