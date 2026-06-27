import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  verifyTypedData,
  isAddress,
  type Address,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  GOVERNANCE_TOKEN_ADDRESS,
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

// token is part of the signed message (kept for ABI/signature compatibility
// with the deployed contract), but its value is never trusted from the
// client — see tokenAddress override below.
const PROPOSE_TYPES = {
  Propose: [
    { name: "recipient", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "expiresAt", type: "uint64" },
    { name: "title", type: "string" },
    { name: "rationale", type: "string" },
    { name: "category", type: "uint8" },
  ],
} as const;

const MAX_OPEN_PROPOSALS = 10;
const MAX_TITLE_LENGTH = 120;
const MAX_RATIONALE_LENGTH = 2000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      recipient,
      amount,
      expiresAt,
      title,
      rationale,
      category,
      signature,
      signerAddress,
    } = body;

    if (
      !recipient ||
      !amount ||
      !expiresAt ||
      !title ||
      category === undefined ||
      !signature ||
      !signerAddress
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (
      !isAddress(recipient) ||
      recipient === "0x0000000000000000000000000000000000000000"
    ) {
      return NextResponse.json(
        { error: "Invalid recipient address" },
        { status: 400 }
      );
    }

    let amountBigInt: bigint;
    try {
      amountBigInt = BigInt(amount);
    } catch {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (amountBigInt <= BigInt(0)) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    const expiresAtBigInt = BigInt(expiresAt);
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    if (expiresAtBigInt <= nowSeconds) {
      return NextResponse.json(
        { error: "expiresAt must be in the future" },
        { status: 400 }
      );
    }

    if (
      typeof title !== "string" ||
      title.trim().length === 0 ||
      title.length > MAX_TITLE_LENGTH
    ) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }

    if (
      typeof rationale === "string" &&
      rationale.length > MAX_RATIONALE_LENGTH
    ) {
      return NextResponse.json(
        { error: "Rationale too long" },
        { status: 400 }
      );
    }

    const categoryNum = Number(category);
    if (!Number.isInteger(categoryNum) || categoryNum < 0 || categoryNum > 4) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    // Always use the canonical governance token address server-side,
    // regardless of anything the client might send — this is what actually
    // prevents a proposal from being bricked with a bad/zero token address,
    // not just hiding the input field in the UI.
    const tokenAddress =
      "0x739B686CF020Ff640a2a0BaA3CE30D31980E36DD" as `0x${string}`;

    // ── Verify signature ──────────────────────────────────────────────────────
    const valid = await verifyTypedData({
      address: signerAddress as Address,
      domain: DOMAIN,
      types: PROPOSE_TYPES,
      primaryType: "Propose",
      message: {
        recipient: recipient as Address,
        token: tokenAddress,
        amount: amountBigInt,
        expiresAt: expiresAtBigInt,
        title: title.trim(),
        rationale: (rationale ?? "").trim(),
        category: categoryNum,
      },
      signature,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ── On-chain checks ───────────────────────────────────────────────────────
    const openCount = (await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "openProposalCount",
    })) as bigint;

    if (openCount >= BigInt(MAX_OPEN_PROPOSALS)) {
      return NextResponse.json(
        { error: `Open proposal cap reached (${MAX_OPEN_PROPOSALS})` },
        { status: 409 }
      );
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    const hash = await walletClient.writeContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "submitProposal",
      args: [
        recipient as Address,
        tokenAddress,
        amountBigInt,
        expiresAtBigInt,
        title.trim(),
        (rationale ?? "").trim(),
        categoryNum,
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
