"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useSignTypedData } from "wagmi";
import { arbitrumSepolia } from "viem/chains";
import { Navbar } from "@/components/NavBar";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  VAULTIS_LENS_ADDRESS,
  VAULTIS_LENS_ABI,
  CATEGORY_OPTIONS,
  CATEGORY_LABELS,
} from "@/lib/config/contract";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  CheckCircle2,
  ShieldCheck,
  FileText,
  Layers,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

// EIP-712 domain + types — must match relay/propose/route.ts exactly
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

// Native token sentinel
const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

export default function ProposePage() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const [recipient, setRecipient] = useState("");
  const [token, setToken] = useState(NATIVE_TOKEN);
  const [amountHint, setAmountHint] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [category, setCategory] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const { data: cycleId } = useReadContract({
    address: VAULTIS_ADDRESS,
    abi: VAULTIS_ABI,
    functionName: "cycleId",
  });

  const { data: currentPhase } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getCurrentPhase",
  });

  const { data: rawProposals, refetch: refetchProposals } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getAllProposals",
  });

  type Proposal = {
    recipient: string;
    token: string;
    encAmountHint: bigint;
    unlockAt: bigint;
    title: string;
    rationale: string;
    category: number;
    proposer: string;
  };

  const proposals = (rawProposals as Proposal[] | undefined) ?? [];

  const handlePropose = async () => {
    if (!address || !cycleId || !title || !recipient || !unlockDate) return;
    setError("");

    // Parse unlock timestamp
    const unlockTs = Math.floor(new Date(unlockDate).getTime() / 1000);
    if (unlockTs <= Math.floor(Date.now() / 1000)) {
      setError("Unlock date must be in the future");
      return;
    }

    // Validate address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      setError("Invalid recipient address");
      return;
    }

    const hintBigInt = BigInt(Math.round(Number(amountHint) || 0));

    try {
      setIsPending(true);

      const signature = await signTypedDataAsync({
        domain: DOMAIN,
        types: PROPOSE_TYPES,
        primaryType: "Propose",
        message: {
          cycleId: BigInt(cycleId as bigint),
          recipient: recipient as `0x${string}`,
          token: token as `0x${string}`,
          encAmountHint: hintBigInt,
          unlockAt: BigInt(unlockTs),
          title: title.trim(),
          rationale: rationale.trim(),
          category: category,
        },
      });

      const res = await fetch("/api/relay/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId: (cycleId as bigint).toString(),
          recipient: recipient.trim(),
          token: token.trim(),
          encAmountHint: hintBigInt.toString(),
          unlockAt: unlockTs.toString(),
          title: title.trim(),
          rationale: rationale.trim(),
          category,
          signature,
          signerAddress: address,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Relay failed");

      setSubmitted(true);
      setRecipient("");
      setToken(NATIVE_TOKEN);
      setAmountHint("");
      setUnlockDate("");
      setTitle("");
      setRationale("");
      setCategory(0);
      refetchProposals();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Something went wrong");
    } finally {
      setIsPending(false);
    }
  };

  const notProposalPhase = currentPhase !== "Proposal";

  return (
    <div className="min-h-screen bg-fhenix-bg text-fhenix-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-14 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-fhenix-cyan/5 blur-[100px] pointer-events-none rounded-full" />

        {/* Page header */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono tracking-[0.3em] text-fhenix-cyan/50 border border-fhenix-navy px-2.5 py-1">
              PHASE 01
            </span>
            <span className="text-[10px] font-mono tracking-[0.3em] text-fhenix-muted flex items-center gap-1.5">
              <Lock size={9} /> ANONYMOUS
            </span>
          </div>
          <h1 className="text-4xl font-mono font-bold tracking-tight text-fhenix-white">
            Submit Proposal
          </h1>
          <p className="text-fhenix-muted text-sm mt-2 max-w-sm leading-relaxed">
            Allocation requests are routed through the relayer.{" "}
            <span className="text-fhenix-purple/70">
              The market sees nothing until the cycle executes.
            </span>
          </p>
        </motion.div>

        {/* Not connected */}
        <AnimatePresence>
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-navy bg-fhenix-card px-6 py-5 text-fhenix-muted text-sm mb-8 flex items-center gap-3 font-mono"
            >
              <Lock size={14} className="text-fhenix-cyan/40 shrink-0" />
              connect your wallet to submit a proposal
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wrong phase */}
        <AnimatePresence>
          {isConnected && notProposalPhase && !submitted && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-navy bg-fhenix-card px-6 py-5 text-fhenix-muted text-sm mb-8 flex items-center gap-3 font-mono"
            >
              <Lock size={14} className="text-fhenix-cyan/40 shrink-0" />
              proposal window is closed — current phase:{" "}
              <span className="text-fhenix-cyan/60">
                {currentPhase ?? "..."}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Proposal form */}
        <AnimatePresence>
          {isConnected && !notProposalPhase && !submitted && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-navy bg-fhenix-card px-6 py-6 mb-8"
            >
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck size={13} className="text-fhenix-cyan/50" />
                <p className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted">
                  ALLOCATION PROPOSAL · RELAYER ANONYMOUS
                </p>
              </div>

              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label className="text-[10px] font-mono text-fhenix-muted block mb-2 tracking-[0.2em]">
                    PROPOSAL TITLE
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Q3 Core Dev Runway"
                    className="w-full bg-fhenix-bg border border-fhenix-navy text-fhenix-white text-sm font-mono px-4 py-3 focus:outline-none focus:border-fhenix-cyan/50 placeholder:text-fhenix-navy transition-colors"
                  />
                </div>

                {/* Recipient */}
                <div>
                  <label className="text-[10px] font-mono text-fhenix-muted block mb-2 tracking-[0.2em]">
                    RECIPIENT ADDRESS
                  </label>
                  <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-fhenix-bg border border-fhenix-navy text-fhenix-white text-sm font-mono px-4 py-3 focus:outline-none focus:border-fhenix-cyan/50 placeholder:text-fhenix-navy transition-colors"
                  />
                </div>

                {/* Token + Amount hint */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono text-fhenix-muted block mb-2 tracking-[0.2em]">
                      TOKEN ADDRESS
                      <span className="opacity-40 normal-case tracking-normal ml-1">
                        (0x0 = native)
                      </span>
                    </label>
                    <input
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="0x0000...0000"
                      className="w-full bg-fhenix-bg border border-fhenix-navy text-fhenix-white text-sm font-mono px-4 py-3 focus:outline-none focus:border-fhenix-cyan/50 placeholder:text-fhenix-navy transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-fhenix-muted block mb-2 tracking-[0.2em]">
                      AMOUNT HINT
                      <span className="opacity-40 normal-case tracking-normal ml-1">
                        (base units)
                      </span>
                    </label>
                    <input
                      value={amountHint}
                      onChange={(e) => setAmountHint(e.target.value)}
                      placeholder="e.g. 50000"
                      type="number"
                      min="0"
                      className="w-full bg-fhenix-bg border border-fhenix-navy text-fhenix-white text-sm font-mono px-4 py-3 focus:outline-none focus:border-fhenix-cyan/50 placeholder:text-fhenix-navy transition-colors"
                    />
                  </div>
                </div>

                {/* Unlock date + Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono text-fhenix-muted block mb-2 tracking-[0.2em]">
                      UNLOCK DATE
                    </label>
                    <input
                      value={unlockDate}
                      onChange={(e) => setUnlockDate(e.target.value)}
                      type="datetime-local"
                      className="w-full bg-fhenix-bg border border-fhenix-navy text-fhenix-white text-sm font-mono px-4 py-3 focus:outline-none focus:border-fhenix-cyan/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-fhenix-muted block mb-2 tracking-[0.2em]">
                      CATEGORY
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(Number(e.target.value))}
                      className="w-full bg-fhenix-bg border border-fhenix-navy text-fhenix-white text-sm font-mono px-4 py-3 focus:outline-none focus:border-fhenix-cyan/50 transition-colors"
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rationale */}
                <div>
                  <label className="text-[10px] font-mono text-fhenix-muted block mb-2 tracking-[0.2em]">
                    RATIONALE
                    <span className="opacity-40 normal-case tracking-normal ml-1">
                      stored on-chain, always public
                    </span>
                  </label>
                  <textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Why should the DAO fund this? What's the expected outcome?"
                    rows={3}
                    className="w-full bg-fhenix-bg border border-fhenix-navy text-fhenix-white text-sm font-mono px-4 py-3 focus:outline-none focus:border-fhenix-cyan/50 placeholder:text-fhenix-navy transition-colors resize-none"
                  />
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-[10px] font-mono text-red-400"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  onClick={handlePropose}
                  disabled={isPending || !title || !recipient || !unlockDate}
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative w-full border border-fhenix-cyan text-fhenix-cyan py-3 text-xs font-mono tracking-[0.2em] hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden mt-1 flex items-center justify-center gap-2"
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  <FileText size={11} />
                  {isPending ? "signing & relaying..." : "SUBMIT PROPOSAL"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success state */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-cyan/30 bg-fhenix-cyan/5 px-6 py-5 mb-8 flex items-center gap-3"
            >
              <CheckCircle2 size={16} className="text-fhenix-cyan shrink-0" />
              <div>
                <p className="text-sm text-fhenix-cyan font-mono">
                  proposal submitted
                </p>
                <p className="text-[10px] text-fhenix-muted mt-0.5">
                  routed through relayer — your address never touched the chain
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Proposals list */}
        <motion.div
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted flex items-center gap-2">
              <Layers size={11} className="text-fhenix-cyan/40" />
              ACTIVE PROPOSALS
            </span>
            <span className="text-[10px] font-mono text-fhenix-cyan/50 border border-fhenix-navy px-2 py-0.5">
              {proposals.length} TOTAL
            </span>
          </div>

          {proposals.length === 0 ? (
            <div className="border border-fhenix-navy px-4 py-8 text-center text-fhenix-muted text-sm font-mono">
              no proposals yet
            </div>
          ) : (
            <div className="space-y-1.5">
              {proposals.map((p, i) => (
                <motion.div
                  key={i}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  className="border border-fhenix-navy bg-fhenix-card px-4 py-3 hover:border-fhenix-cyan/20 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-mono text-fhenix-white group-hover:text-fhenix-cyan/90 transition-colors truncate">
                        {p.title}
                      </div>
                      <div className="text-xs text-fhenix-muted mt-0.5 font-mono truncate">
                        → {p.recipient.slice(0, 6)}...{p.recipient.slice(-4)}
                      </div>
                      {p.rationale && (
                        <div className="text-[11px] text-fhenix-muted/60 mt-1 line-clamp-1">
                          {p.rationale}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[9px] font-mono border border-fhenix-navy px-1.5 py-0.5 text-fhenix-muted tracking-widest">
                        {CATEGORY_LABELS[p.category] ?? "Other"}
                      </span>
                      <span className="text-[10px] font-mono text-fhenix-navy group-hover:text-fhenix-cyan/30 transition-colors">
                        #{String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
