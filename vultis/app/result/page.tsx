"use client";

import {
  useAccount,
  useReadContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { Navbar } from "@/components/NavBar";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  VAULTIS_LENS_ADDRESS,
  VAULTIS_LENS_ABI,
  CATEGORY_LABELS,
} from "@/lib/config/contract";
import { connectCofhe, decryptTallyPair } from "@/lib/fhe/fhenix";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Lock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Layers,
  RefreshCw,
  Clock,
  AlertTriangle,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

export default function ResultsPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState("");
  const [finalizeSuccess, setFinalizeSuccess] = useState(false);
  const [finalizeStep, setFinalizeStep] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState("");
  const [nextLabel, setNextLabel] = useState("");
  const [vetoingId, setVetoingId] = useState<number | null>(null);
  const [vetoError, setVetoError] = useState("");

  const { data: currentPhase } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getCurrentPhase",
  });

  const { data: owner } = useReadContract({
    address: VAULTIS_ADDRESS,
    abi: VAULTIS_ABI,
    functionName: "owner",
  });

  const { data: cycleId } = useReadContract({
    address: VAULTIS_ADDRESS,
    abi: VAULTIS_ABI,
    functionName: "cycleId",
  });

  const { data: resultsData } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getResults",
    query: { enabled: currentPhase === "Executed" },
  });

  const { data: allProposals } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getAllProposals",
  });

  const { data: archiveData } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getArchive",
  });

  console.log("archive raw:", archiveData);

  const isOwner =
    !!address &&
    address.toLowerCase() === (owner as string | undefined)?.toLowerCase();

  type ResultsReturn = readonly [string[], bigint[], bigint[], boolean[]];
  type ExecutedCycle = {
    cycleId: bigint;
    approvedCount: bigint;
    rejectedCount: bigint;
    totalAllocated: bigint;
  };
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

  const [resTitles, resFor, resAgainst, resApproved] = (resultsData as
    | ResultsReturn
    | undefined) ?? [[], [], [], []];
  const proposals = (allProposals as Proposal[] | undefined) ?? [];
  const archive = (archiveData as ExecutedCycle[] | undefined) ?? [];

  // ── Finalize (Tally → Veto) ────────────────────────────────────────────────
  const handleFinalize = async () => {
    if (!publicClient || !walletClient) return;
    setFinalizeError("");
    setIsFinalizing(true);
    try {
      setFinalizeStep("finalizing on-chain...");
      const res1 = await fetch("/api/relay/finalize", { method: "POST" });
      const d1 = await res1.json();
      if (!res1.ok) throw new Error(d1.error ?? "Finalize failed");

      const forHandles: string[] = d1.forHandles.map(
        (h: any) => h?.toString() ?? "0"
      );
      const againstHandles: string[] = d1.againstHandles.map(
        (h: any) => h?.toString() ?? "0"
      );

      setFinalizeStep("decrypting tallies via CoFHE (~30s)...");
      await connectCofhe(walletClient, publicClient);

      const pairs = await Promise.all(
        forHandles.map(async (fh, i) => {
          const { forCount, againstCount } = await decryptTallyPair(
            fh,
            againstHandles[i]
          );
          return { forCount, againstCount };
        })
      );

      setFinalizeStep("publishing allocations...");
      const res2 = await fetch("/api/relay/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forCounts: pairs.map((p) => p.forCount),
          againstCounts: pairs.map((p) => p.againstCount),
        }),
      });
      const d2 = await res2.json();
      if (!res2.ok) throw new Error(d2.error ?? "Publish failed");

      setFinalizeSuccess(true);
    } catch (e: any) {
      console.error(e);
      setFinalizeError(e?.message ?? "Something went wrong");
    } finally {
      setIsFinalizing(false);
      setFinalizeStep("");
    }
  };

  // ── Veto a proposal (owner-only, Veto phase) ──────────────────────────────
  const handleVeto = async (proposalId: number) => {
    if (!walletClient || !address || !cycleId) return;
    setVetoError("");
    setVetoingId(proposalId);
    try {
      const res = await fetch("/api/relay/veto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId: (cycleId as bigint).toString(),
          proposalId,
          reason: "Owner veto",
          signerAddress: address,
          signature: "0x",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Veto failed");
    } catch (e: any) {
      setVetoError(e?.message ?? "Veto failed");
    } finally {
      setVetoingId(null);
    }
  };

  // ── Open next cycle ────────────────────────────────────────────────────────
  const handleOpenNextCycle = async () => {
    if (!walletClient || !publicClient || !nextLabel.trim()) return;
    setIsOpening(true);
    setOpenError("");
    try {
      const { maxFeePerGas, maxPriorityFeePerGas } =
        await publicClient.estimateFeesPerGas();
      const hash = await walletClient.writeContract({
        address: VAULTIS_ADDRESS,
        abi: VAULTIS_ABI,
        functionName: "openNextCycle",
        args: [nextLabel],
        account: walletClient.account,
        maxFeePerGas,
        maxPriorityFeePerGas,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      window.location.reload();
    } catch (e: any) {
      setOpenError(
        e?.shortMessage ?? e?.message ?? "Failed to open next cycle"
      );
    } finally {
      setIsOpening(false);
    }
  };

  const isExecuted = currentPhase === "Executed";
  const isTally = currentPhase === "Tally";
  const isVeto = currentPhase === "Veto";

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
              PHASE 04
            </span>
            <span className="text-[10px] font-mono tracking-[0.3em] text-fhenix-muted flex items-center gap-1.5">
              <Lock size={9} /> DECRYPTED
            </span>
          </div>
          <h1 className="text-4xl font-mono font-bold tracking-tight text-fhenix-white">
            Cycle Results
          </h1>
          <p className="text-fhenix-muted text-sm mt-2 max-w-sm leading-relaxed">
            Allocations are decrypted by the FHE network.{" "}
            <span className="text-fhenix-purple/70">
              Token-weighted votes, revealed accurately.
            </span>
          </p>
        </motion.div>

        {/* ── Tally phase: decrypt + publish ──────────────────────────────── */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mb-8"
        >
          {isTally && (
            <div className="border border-fhenix-navy bg-fhenix-card px-6 py-10 text-center">
              <div className="flex flex-col items-center gap-4">
                <Clock size={20} className="text-fhenix-cyan/40" />
                <div className="text-fhenix-white/70 text-sm font-mono">
                  votes are tallied — awaiting FHE decryption
                </div>
                <p className="text-[10px] font-mono text-fhenix-muted max-w-xs leading-relaxed">
                  decrypt FOR and AGAINST tallies in your browser, then publish
                  allocations on-chain.
                </p>
                <AnimatePresence>
                  {!finalizeSuccess && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-3 mt-2"
                    >
                      <motion.button
                        onClick={handleFinalize}
                        disabled={isFinalizing}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative inline-flex items-center gap-2 border border-fhenix-cyan text-fhenix-cyan px-6 py-2.5 text-xs font-mono tracking-widest hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-200 disabled:opacity-40 overflow-hidden"
                      >
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                        <RefreshCw
                          size={12}
                          className={isFinalizing ? "animate-spin" : ""}
                        />
                        {isFinalizing
                          ? finalizeStep.toUpperCase()
                          : "DECRYPT & PUBLISH ALLOCATIONS"}
                      </motion.button>
                      {finalizeError && (
                        <p className="text-[10px] font-mono text-red-400">
                          {finalizeError}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {finalizeSuccess && (
                  <p className="text-[10px] font-mono text-fhenix-cyan mt-2">
                    allocations published — veto window now open
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Veto phase: owner controls ──────────────────────────────────── */}
          {isVeto && (
            <div className="border border-red-500/30 bg-fhenix-card px-6 py-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={13} className="text-red-400" />
                <span className="text-[10px] font-mono tracking-[0.2em] text-red-400">
                  VETO WINDOW OPEN
                </span>
              </div>
              <p className="text-[11px] font-mono text-fhenix-muted/70 mb-4 leading-relaxed">
                {isOwner
                  ? "As the contract owner, you may veto individual proposals before allocations are final."
                  : "The contract owner may veto individual proposals during this window."}
              </p>
              {isOwner && proposals.length > 0 && (
                <div className="space-y-2">
                  {proposals.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between border border-fhenix-navy px-4 py-2.5"
                    >
                      <span className="text-xs font-mono text-fhenix-white truncate max-w-[60%]">
                        {p.title}
                      </span>
                      <button
                        onClick={() => handleVeto(i)}
                        disabled={vetoingId === i}
                        className="text-[9px] font-mono border border-red-500/50 text-red-400 px-3 py-1 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-40 tracking-widest"
                      >
                        {vetoingId === i ? "VETOING..." : "VETO"}
                      </button>
                    </div>
                  ))}
                  {vetoError && (
                    <p className="text-[10px] font-mono text-red-400 mt-1">
                      {vetoError}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Not yet ─────────────────────────────────────────────────────── */}
          {!isExecuted && !isTally && !isVeto && (
            <div className="border border-fhenix-navy bg-fhenix-card px-6 py-10 text-center">
              <div className="text-fhenix-muted text-sm font-mono flex items-center justify-center gap-2 py-4">
                <ShieldCheck size={14} className="text-fhenix-navy" />
                results appear after voting closes — current phase:{" "}
                <span className="text-fhenix-cyan/60">
                  {currentPhase ?? "..."}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Executed: approved proposals leaderboard ─────────────────────── */}
        <AnimatePresence>
          {isExecuted && resTitles.length > 0 && (
            <motion.div
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="mb-6"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted flex items-center gap-2">
                  <Layers size={11} className="text-fhenix-cyan/40" />
                  ALLOCATION RESULTS
                </span>
                <span className="text-[10px] font-mono text-fhenix-cyan/50 border border-fhenix-navy px-2 py-0.5">
                  {resTitles.length} PROPOSALS
                </span>
              </div>
              <div className="space-y-1.5">
                {resTitles.map((title, i) => {
                  const approved = resApproved[i];
                  const forPts = Number(resFor[i]);
                  const againPts = Number(resAgainst[i]);
                  const total = forPts + againPts;
                  const pct =
                    total > 0 ? Math.round((forPts / total) * 100) : 0;
                  return (
                    <motion.div
                      key={i}
                      custom={i}
                      variants={fadeUp}
                      initial="hidden"
                      animate="show"
                      className={`border bg-fhenix-card px-4 py-3 transition-colors ${
                        approved
                          ? "border-fhenix-cyan/40 bg-fhenix-cyan/[0.02]"
                          : "border-fhenix-navy"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {approved ? (
                            <CheckCircle2
                              size={13}
                              className="text-fhenix-cyan shrink-0"
                            />
                          ) : (
                            <XCircle
                              size={13}
                              className="text-fhenix-muted/40 shrink-0"
                            />
                          )}
                          <div>
                            <div
                              className={`text-sm font-mono ${
                                approved
                                  ? "text-fhenix-white font-bold"
                                  : "text-fhenix-white/60"
                              }`}
                            >
                              {title}
                            </div>
                            <div className="text-[10px] font-mono text-fhenix-muted mt-0.5">
                              {CATEGORY_LABELS[proposals[i]?.category ?? 4] ??
                                "Other"}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {approved && (
                            <span className="text-[9px] font-mono border border-fhenix-cyan px-2 py-0.5 text-fhenix-cyan tracking-wider">
                              APPROVED
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-fhenix-muted">
                            {pct}% FOR
                          </span>
                        </div>
                      </div>
                      {/* FOR/AGAINST bar */}
                      <div className="h-1 w-full bg-fhenix-navy rounded-full overflow-hidden">
                        <div
                          className="h-full bg-fhenix-cyan/60 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-fhenix-muted/60 mt-1">
                        <span>{forPts} FOR</span>
                        <span>{againPts} AGAINST</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Open next cycle — shown whenever Executed, gated on isOwner ── */}
        <AnimatePresence>
          {isExecuted && (
            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="mb-10"
            >
              <div className="border border-fhenix-navy bg-fhenix-card px-6 py-6">
                <div className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted mb-3">
                  START NEXT CYCLE
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Cycle label, e.g. Q4 2026 Treasury..."
                    value={nextLabel}
                    onChange={(e) => setNextLabel(e.target.value)}
                    className="flex-1 bg-transparent border border-fhenix-cyan/50 text-fhenix-white text-xs font-mono px-3 py-2 focus:outline-none focus:border-fhenix-cyan placeholder:text-fhenix-muted/40"
                  />
                  <motion.button
                    onClick={handleOpenNextCycle}
                    disabled={isOpening || !nextLabel.trim()}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="border border-fhenix-cyan text-fhenix-cyan px-4 py-2 text-xs font-mono tracking-widest hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-200 disabled:opacity-40"
                  >
                    {isOpening ? "OPENING..." : "OPEN →"}
                  </motion.button>
                </div>
                {openError && (
                  <p className="text-[10px] font-mono text-red-400 mt-2">
                    {openError}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Archive ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {archive.length > 0 && (
            <motion.div
              custom={4}
              variants={fadeUp}
              initial="hidden"
              animate="show"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted flex items-center gap-2">
                  <Layers size={11} className="text-fhenix-cyan/40" />
                  PAST CYCLES
                </span>
              </div>
              <div className="space-y-1.5">
                {archive.map((c, i) => (
                  <motion.div
                    key={i}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="flex items-center justify-between border border-fhenix-navy bg-fhenix-card px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-mono text-fhenix-white">
                        Cycle {c.cycleId.toString()}
                      </div>
                      <div className="text-xs text-fhenix-muted mt-0.5">
                        {c.approvedCount.toString()} approved ·{" "}
                        {c.rejectedCount.toString()} rejected
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-fhenix-muted">
                        ~{c.totalAllocated.toString()} units
                      </span>
                      <span className="text-[10px] font-mono text-fhenix-navy">
                        CYCLE {c.cycleId.toString()}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
