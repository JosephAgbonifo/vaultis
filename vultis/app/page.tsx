"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Navbar } from "@/components/NavBar";
import { useReadContract } from "wagmi";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  VAULTIS_LENS_ADDRESS,
  VAULTIS_LENS_ABI,
  GOVERNANCE_TOKEN_ADDRESS,
  GOVERNANCE_TOKEN_ABI,
} from "@/lib/config/contract";
import { motion } from "framer-motion";
import {
  Vault,
  ShieldCheck,
  Lock,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Zap,
  Coins,
} from "lucide-react";
import { formatEther } from "viem";

// ─── LIFECYCLE STEPS ──────────────────────────────────────────────────────────
// Continuous, per-proposal model — no global phases. Each proposal moves
// through these three states independently, on its own expiry clock.
const STEPS = [
  {
    step: "01",
    title: "Propose",
    desc: "Submit a proposal anytime, set its own expiration.",
    Icon: Vault,
  },
  {
    step: "02",
    title: "Vote",
    desc: "Cast encrypted FHE ballots until that proposal expires.",
    Icon: ShieldCheck,
  },
  {
    step: "03",
    title: "Auto-Resolve",
    desc: "Tally decrypts and treasury funds move on expiry — no admin step.",
    Icon: Zap,
  },
];

// ─── ANIMATED GRID BACKDROP ───────────────────────────────────────────────────
function GridBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden
    >
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.035]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="vaultis-grid"
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
        <rect width="100%" height="100%" fill="url(#vaultis-grid)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-fhenix-bg via-transparent to-fhenix-bg" />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)",
          top: "-5%",
          left: "-8%",
        }}
        animate={{ scale: [1, 1.12, 1], x: [0, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
          bottom: "5%",
          right: "-5%",
        }}
        animate={{ scale: [1, 1.08, 1], x: [0, -30, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

type IconComponent = React.ComponentType<
  React.SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }
>;

function LifecycleStep({
  step,
  title,
  desc,
  Icon,
  index,
  total,
}: {
  step: string;
  title: string;
  desc: string;
  Icon: IconComponent;
  index: number;
  total: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.25 + index * 0.07,
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative flex flex-col"
    >
      {index < total - 1 && (
        <div
          className="hidden md:block absolute top-[28px] z-0"
          style={{
            left: "calc(50% + 36px)",
            right: "-12px",
            height: "1px",
            background:
              "linear-gradient(to right, rgba(34,211,238,0.25), rgba(34,211,238,0.05))",
          }}
        />
      )}

      <div
        className="relative z-10 flex flex-col items-center text-center p-5 rounded-2xl border h-full transition-all duration-500 group cursor-default border-white/[0.05] hover:border-fhenix-cyan/20"
        style={{
          background: "rgba(255,255,255,0.01)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 bg-white/[0.04] border border-white/[0.06] group-hover:bg-fhenix-cyan/10 group-hover:border-fhenix-cyan/30">
          <Icon
            size={16}
            className="text-white/50 group-hover:text-fhenix-cyan transition-colors duration-300"
            strokeWidth={1.75}
          />
        </div>

        <span className=" text-[9px] tracking-[0.2em] mb-1 text-fhenix-cyan/40">
          {step}
        </span>

        <h3 className=" font-bold text-sm mb-1.5 text-white/70 group-hover:text-white transition-colors">
          {title}
        </h3>

        <p className="text-[11px] leading-relaxed text-fhenix-muted">{desc}</p>
      </div>
    </motion.div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: proposalCount, isLoading: isCountLoading } = useReadContract({
    address: VAULTIS_ADDRESS as `0x${string}`,
    abi: VAULTIS_ABI,
    functionName: "proposalCount",
  });

  const { data: openProposalCount, isLoading: isOpenLoading } = useReadContract(
    {
      address: VAULTIS_ADDRESS as `0x${string}`,
      abi: VAULTIS_ABI,
      functionName: "openProposalCount",
    }
  );

  const { data: treasuryBalance, isLoading: isTreasuryLoading } =
    useReadContract({
      address: VAULTIS_LENS_ADDRESS as `0x${string}`,
      abi: VAULTIS_LENS_ABI,
      functionName: "treasuryBalance",
      query: { refetchInterval: 20_000 },
    });

  const { data: symbol } = useReadContract({
    address: GOVERNANCE_TOKEN_ADDRESS as `0x${string}`,
    abi: GOVERNANCE_TOKEN_ABI,
    functionName: "symbol",
  });

  const formattedTreasury = useMemo(() => {
    if (treasuryBalance === undefined) return null;
    const n = parseFloat(formatEther(treasuryBalance as bigint));
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }, [treasuryBalance]);

  const isLoading = isCountLoading || isOpenLoading || isTreasuryLoading;

  return (
    <div className="min-h-screen bg-fhenix-bg text-fhenix-white flex flex-col antialiased selection:bg-fhenix-cyan/20 selection:text-fhenix-white overflow-x-hidden">
      <Navbar />

      <main className="flex-1 flex flex-col items-center px-6 py-24 md:py-32 relative">
        <GridBackdrop />

        {/* ── HERO ── */}
        <div className="relative z-10 w-full max-w-4xl text-center flex flex-col items-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border  text-[10px] tracking-[0.3em] font-semibold"
            style={{
              borderColor: "rgba(34,211,238,0.25)",
              background: "rgba(34,211,238,0.04)",
              color: "#22d3ee",
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-fhenix-cyan animate-pulse" />
            HOMOMORPHICALLY SEALED TREASURY
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-5 select-none"
          >
            <div
              className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-sm opacity-[0.15]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.5) 3px, rgba(0,0,0,0.5) 4px)",
              }}
            />
            <h1
              className="text-[clamp(72px,13vw,128px)]  font-black leading-none"
              style={{
                background:
                  "linear-gradient(160deg, #ffffff 0%, #cffafe 55%, #22d3ee 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 56px rgba(34,211,238,0.2))",
                letterSpacing: "-0.04em",
              }}
            >
              VAULTIS
            </h1>
            <div
              aria-hidden
              className="absolute inset-0 flex items-center justify-center blur-3xl opacity-[0.07] -z-10 pointer-events-none"
            >
              <span
                className="text-[clamp(72px,13vw,128px)]  font-black text-fhenix-cyan"
                style={{ letterSpacing: "-0.04em" }}
              >
                VAULTIS
              </span>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className=" text-sm md:text-base font-semibold tracking-widest mb-3"
            style={{ color: "rgba(255,255,255,0.8)", letterSpacing: "0.08em" }}
          >
            Next-generation private cryptographic governance.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            className=" text-xs md:text-sm max-w-lg leading-relaxed text-fhenix-muted"
          >
            Submit allocation proposals anytime. Vote with FHE-encrypted weight.
            The treasury pays out — or doesn&apos;t — the moment each proposal
            expires, with no admin in the loop.
          </motion.p>
        </div>

        {/* ── LIFECYCLE ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="relative z-10 w-full max-w-4xl mb-16"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className=" text-[9px] tracking-[0.3em] font-bold text-fhenix-cyan/50">
              LIFECYCLE
            </span>
            <div className="flex-1 h-px bg-white/[0.05]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {STEPS.map((s, i) => (
              <LifecycleStep
                key={s.step}
                {...s}
                index={i}
                total={STEPS.length}
              />
            ))}
          </div>
        </motion.section>

        {/* ── METRICS + CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="relative z-10 w-full max-w-5xl"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className=" text-[9px] tracking-[0.3em] font-bold text-fhenix-cyan/50">
              SYSTEM
            </span>
            <div className="flex-1 h-px bg-white/[0.05]" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Metric: Treasury */}
            <div
              className="lg:col-span-4 flex flex-col justify-between p-6 rounded-2xl border"
              style={{
                background: "rgba(255,255,255,0.01)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Coins size={13} className="text-fhenix-cyan opacity-60" />
                <span className=" text-[10px] tracking-widest text-fhenix-muted">
                  TREASURY BALANCE
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className=" text-4xl font-black text-white">
                  {isTreasuryLoading ? (
                    <Loader2 size={20} className="animate-spin opacity-30" />
                  ) : (
                    formattedTreasury ?? "0"
                  )}
                </span>
                <span className="text-xs text-fhenix-muted/50">
                  {(symbol as string) ?? "VLTG"}
                </span>
              </div>
            </div>

            {/* Metric: Open proposals */}
            <div
              className="lg:col-span-4 flex flex-col justify-between p-6 rounded-2xl border"
              style={{
                background: "rgba(255,255,255,0.01)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Vault size={13} className="text-fhenix-cyan opacity-60" />
                <span className=" text-[10px] tracking-widest text-fhenix-muted">
                  OPEN / TOTAL PROPOSALS
                </span>
              </div>
              <span className=" text-4xl font-black text-white">
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin opacity-30" />
                ) : (
                  <>
                    {openProposalCount?.toString() ?? "0"}
                    <span className="text-lg text-fhenix-muted/40">
                      {" "}
                      / {proposalCount?.toString() ?? "0"}
                    </span>
                  </>
                )}
              </span>
            </div>

            {/* CTA */}
            <div className="lg:col-span-4 flex">
              <Link
                href="/proposals"
                className="group relative w-full hidden md:flex items-center justify-center gap-3 rounded-2xl border border-fhenix-cyan text-fhenix-cyan  text-[11px] tracking-[0.2em] font-bold transition-all duration-300 overflow-hidden hover:bg-fhenix-cyan hover:text-fhenix-bg hover:shadow-[0_0_40px_rgba(34,211,238,0.3)]"
                style={{ backdropFilter: "blur(20px)" }}
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <Lock
                  size={13}
                  className="transition-transform group-hover:scale-110"
                />
                <span>VIEW PROPOSALS</span>
                <ArrowRight
                  size={13}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
            </div>
            <div className="lg:col-span-4 flex">
              <Link
                href="/proposals"
                className="group relative w-full flex h-12 md:hidden items-center justify-center gap-3 rounded-2xl border border-fhenix-cyan text-fhenix-cyan  text-[11px] tracking-[0.2em] font-bold transition-all duration-300 overflow-hidden hover:bg-fhenix-cyan hover:text-fhenix-bg hover:shadow-[0_0_40px_rgba(34,211,238,0.3)]"
                style={{ backdropFilter: "blur(20px)" }}
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <Lock
                  size={13}
                  className="transition-transform group-hover:scale-110"
                />
                <span>VIEW PROPOSALS</span>
                <ArrowRight
                  size={13}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
            </div>
            <div className="lg:col-span-12 flex">
              <Link
                href="/propose"
                className="group relative w-full flex h-12 items-center justify-center gap-3 rounded-2xl border border-fhenix-cyan text-fhenix-cyan  text-[11px] tracking-[0.2em] font-bold transition-all duration-300 overflow-hidden hover:bg-fhenix-cyan hover:text-fhenix-bg hover:shadow-[0_0_40px_rgba(34,211,238,0.3)]"
                style={{ backdropFilter: "blur(20px)" }}
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <Lock
                  size={13}
                  className="transition-transform group-hover:scale-110"
                />
                <span>PROPOSE</span>
                <ArrowRight
                  size={13}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── FOOTER META ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="relative z-10 mt-20 flex flex-wrap items-center justify-center gap-4  text-[9px] tracking-[0.3em] select-none text-fhenix-white/20"
        >
          <span>0x7a3f···e91c</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={10} />
            FULLY HOMOMORPHIC ENCRYPTION SECURED
          </span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span className="text-fhenix-cyan/35">SEPOLIA TESTNET</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>COFHE · FHENIX PROTOCOL</span>
        </motion.div>
      </main>
    </div>
  );
}
