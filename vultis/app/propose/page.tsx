"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useSignTypedData } from "wagmi";
import { arbitrumSepolia } from "viem/chains";
import { Navbar } from "@/components/NavBar";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  VAULTIS_LENS_ADDRESS,
  VAULTIS_LENS_ABI,
  GOVERNANCE_TOKEN_ADDRESS,
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
import { parseEther } from "viem";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

const DOMAIN = {
  name: "Vaultis",
  version: "1",
  chainId: arbitrumSepolia.id,
  verifyingContract: VAULTIS_ADDRESS,
} as const;

// token is signed as part of the message (matches the deployed contract's
// ABI) but is never user-editable — it's always GOVERNANCE_TOKEN_ADDRESS,
// since VLTG is the only asset Vaultis pays out in.
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

// ─── SHARED FIELD WRAPPER ─────────────────────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-[9px] tracking-[0.25em] text-fhenix-cyan/50 mb-2 font-semibold">
        {label}
        {hint && (
          <span className="text-fhenix-muted/50 normal-case tracking-normal font-normal">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// ─── INPUT STYLES ─────────────────────────────────────────────────────────────
const inputCls =
  "w-full bg-fhenix-bg border border-fhenix-navy text-fhenix-white text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-fhenix-cyan/50 focus:ring-1 focus:ring-fhenix-cyan/10 placeholder:text-fhenix-navy/60 transition-all duration-200";

// ─── GRID BACKDROP ────────────────────────────────────────────────────────────
function GridBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden
    >
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.025]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="propose-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#propose-grid)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-fhenix-bg via-transparent to-fhenix-bg" />
      <div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.055) 0%, transparent 70%)",
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
    </div>
  );
}

// ─── GLASS CARD ───────────────────────────────────────────────────────────────
function GlassCard({
  children,
  className = "",
  highlight = false,
}: {
  children?: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{
        background: highlight
          ? "rgba(34,211,238,0.02)"
          : "rgba(255,255,255,0.01)",
        border: highlight
          ? "1px solid rgba(34,211,238,0.18)"
          : "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
      }}
    >
      {children}
    </div>
  );
}

export default function ProposePage() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [expiresDate, setExpiresDate] = useState("");
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [category, setCategory] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const { data: openProposalCount } = useReadContract({
    address: VAULTIS_ADDRESS,
    abi: VAULTIS_ABI,
    functionName: "openProposalCount",
  });

  const { data: rawProposals, refetch: refetchProposals } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getAllProposals",
  });

  type ProposalView = {
    id: bigint;
    recipient: string;
    amount: bigint;
    expiresAt: bigint;
    title: string;
    rationale: string;
    category: number;
    proposer: string;
    displayStatus: number;
    finalForCount: bigint;
    finalAgainstCount: bigint;
  };

  const proposals = (rawProposals as ProposalView[] | undefined) ?? [];
  const atCap = Number(openProposalCount ?? 0) >= MAX_OPEN_PROPOSALS;

  const handlePropose = async () => {
    if (!address || !title || !recipient || !expiresDate || !amount) return;
    setError("");

    const expiresTs = Math.floor(new Date(expiresDate).getTime() / 1000);
    if (expiresTs <= Math.floor(Date.now() / 1000)) {
      setError("Expiration must be in the future");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      setError("Invalid recipient address");
      return;
    }

    const amountBigInt = BigInt(Math.round(Number(amount) || 0));
    if (amountBigInt <= BigInt(0)) {
      setError("Amount must be greater than zero");
      return;
    }

    try {
      setIsPending(true);

      const amountString = amountBigInt.toString();

      const signature = await signTypedDataAsync({
        domain: DOMAIN,
        types: PROPOSE_TYPES,
        primaryType: "Propose",
        message: {
          recipient: recipient as `0x${string}`,
          token: GOVERNANCE_TOKEN_ADDRESS,
          amount: parseEther(amountString),
          expiresAt: BigInt(expiresTs),
          title: title.trim(),
          rationale: rationale.trim(),
          category,
        },
      });

      const res = await fetch("/api/relay/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: recipient.trim(),
          token: GOVERNANCE_TOKEN_ADDRESS,
          amount: parseEther(amountString).toString(),
          expiresAt: expiresTs.toString(),
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
      setAmount("");
      setExpiresDate("");
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

  return (
    <div className="min-h-screen bg-fhenix-bg text-fhenix-white flex flex-col antialiased overflow-x-hidden">
      <Navbar />

      <main className="relative flex-1 max-w-2xl mx-auto w-full px-6 py-16">
        <GridBackdrop />

        {/* ── PAGE HEADER ── */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="relative z-10 mb-10"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <span className="flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-fhenix-muted">
              <Lock size={9} /> ANONYMOUS
            </span>
          </div>

          <h1
            className="text-4xl md:text-5xl font-black tracking-tight text-fhenix-white mb-3"
            style={{ letterSpacing: "-0.02em" }}
          >
            Submit Proposal
          </h1>
          <p className="text-fhenix-muted text-sm max-w-sm leading-relaxed font-mono">
            Submit anytime — set your own expiration, then it&apos;s open for
            voting until that deadline.{" "}
            <span style={{ color: "rgba(139,92,246,0.75)" }}>
              The market sees nothing until it resolves.
            </span>
          </p>
        </motion.div>

        <div className="relative z-10 space-y-4">
          {/* ── NOT CONNECTED ── */}
          <AnimatePresence>
            {!isConnected && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <GlassCard className="px-5 py-4 flex items-center gap-3">
                  <Lock size={13} className="text-fhenix-cyan/40 shrink-0" />
                  <p className="text-fhenix-muted text-sm font-mono">
                    connect your wallet to submit a proposal
                  </p>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── AT CAP ── */}
          <AnimatePresence>
            {isConnected && atCap && !submitted && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <GlassCard className="px-5 py-4 flex items-center gap-3">
                  <Lock size={13} className="text-fhenix-cyan/40 shrink-0" />
                  <p className="text-fhenix-muted text-sm font-mono">
                    {MAX_OPEN_PROPOSALS} open proposals already pending — wait
                    for one to resolve before submitting another
                  </p>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── FORM ── */}
          <AnimatePresence>
            {isConnected && !atCap && !submitted && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <GlassCard className="px-6 py-6">
                  {/* form header */}
                  <div className="flex items-center gap-2 mb-6 pb-5 border-b border-white/[0.05]">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: "rgba(34,211,238,0.08)",
                        border: "1px solid rgba(34,211,238,0.18)",
                      }}
                    >
                      <ShieldCheck size={13} className="text-fhenix-cyan" />
                    </div>
                    <p className="text-[9px] tracking-[0.2em] text-fhenix-muted font-semibold">
                      ALLOCATION PROPOSAL · RELAYER ANONYMOUS
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Title */}
                    <Field label="PROPOSAL TITLE">
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Q3 Core Dev Runway"
                        className={inputCls}
                      />
                    </Field>

                    {/* Recipient */}
                    <Field label="RECIPIENT ADDRESS">
                      <input
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder="0x..."
                        className={inputCls}
                      />
                    </Field>

                    {/* Amount + Expiry */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="AMOUNT" hint="(VLTG, base units)">
                        <input
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="e.g. 50000"
                          type="number"
                          min="0"
                          className={inputCls}
                        />
                      </Field>
                      <Field label="EXPIRES AT" hint="voting closes here">
                        <input
                          value={expiresDate}
                          onChange={(e) => setExpiresDate(e.target.value)}
                          type="datetime-local"
                          className={inputCls}
                        />
                      </Field>
                    </div>

                    {/* Category */}
                    <Field label="CATEGORY">
                      <select
                        value={category}
                        onChange={(e) => setCategory(Number(e.target.value))}
                        className={inputCls}
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {/* Rationale */}
                    <Field
                      label="RATIONALE"
                      hint="stored on-chain, always public"
                    >
                      <textarea
                        value={rationale}
                        onChange={(e) => setRationale(e.target.value)}
                        placeholder="Why should the DAO fund this? What's the expected outcome?"
                        rows={3}
                        className={`${inputCls} resize-none`}
                      />
                    </Field>

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-[10px] text-red-400 px-1"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* Submit */}
                    <motion.button
                      onClick={handlePropose}
                      disabled={
                        isPending ||
                        !title ||
                        !recipient ||
                        !expiresDate ||
                        !amount
                      }
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.98 }}
                      className="group relative w-full flex items-center justify-center gap-2 rounded-xl border border-fhenix-cyan text-fhenix-cyan py-3.5 text-xs tracking-[0.2em] font-bold hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden mt-1"
                    >
                      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                      <FileText size={12} />
                      {isPending ? "signing & relaying..." : "SUBMIT PROPOSAL"}
                    </motion.button>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── SUCCESS ── */}
          <AnimatePresence>
            {submitted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <GlassCard
                  highlight
                  className="px-5 py-4 flex items-center gap-3"
                >
                  <CheckCircle2
                    size={16}
                    className="text-fhenix-cyan shrink-0"
                  />
                  <div>
                    <p className="text-sm text-fhenix-cyan font-semibold">
                      proposal submitted
                    </p>
                    <p className="text-[10px] text-fhenix-muted mt-0.5">
                      routed through relayer — your address never touched the
                      chain
                    </p>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PROPOSALS LIST ── */}
          <motion.div
            custom={5}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            <div className="flex items-center justify-between mb-4 mt-2">
              <span className="flex items-center gap-2 text-[9px] tracking-[0.25em] text-fhenix-muted font-semibold">
                <Layers size={11} className="text-fhenix-cyan/40" />
                RECENT PROPOSALS
              </span>
              <span
                className="text-[9px] px-2 py-0.5 rounded-md"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(34,211,238,0.5)",
                }}
              >
                {Number(openProposalCount ?? 0)}/{MAX_OPEN_PROPOSALS} OPEN
              </span>
            </div>

            {proposals.length === 0 ? (
              <GlassCard className="px-4 py-10 text-center">
                <p className="text-fhenix-muted text-sm font-mono">
                  no proposals yet
                </p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {proposals.map((p, i) => (
                  <motion.div
                    key={p.id?.toString() ?? i}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="group rounded-2xl border border-white/[0.05] px-4 py-3.5 hover:border-fhenix-cyan/20 transition-all duration-200 cursor-default"
                    style={{
                      background: "rgba(255,255,255,0.01)",
                      backdropFilter: "blur(16px)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-fhenix-white group-hover:text-fhenix-cyan/90 transition-colors truncate font-semibold">
                          {p.title}
                        </div>
                        <div className="text-xs text-fhenix-muted mt-0.5 truncate">
                          → {p.recipient.slice(0, 6)}...{p.recipient.slice(-4)}
                        </div>
                        {p.rationale && (
                          <div className="text-[11px] text-fhenix-muted/55 mt-1.5 line-clamp-1 leading-relaxed">
                            {p.rationale}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className="text-[9px] px-2 py-0.5 rounded-md tracking-widest"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            color: "rgba(255,255,255,0.35)",
                          }}
                        >
                          {CATEGORY_LABELS[p.category] ?? "Other"}
                        </span>
                        <span className="text-[10px] text-white/20 group-hover:text-fhenix-cyan/30 transition-colors">
                          #{String(i + 1).padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
