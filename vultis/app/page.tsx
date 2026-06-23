"use client";

import Link from "next/link";
import { Navbar } from "@/components/NavBar";
import { useReadContract } from "wagmi";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  VAULTIS_LENS_ADDRESS,
  VAULTIS_LENS_ABI,
} from "@/lib/config/contract";
import { motion } from "framer-motion";
import { Vault, ShieldCheck, Lock } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function Home() {
  // getCurrentPhase lives on VaultisLens (moved off the core contract to
  // stay under the 24KB EVM code-size limit).
  const { data: phase } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getCurrentPhase",
  });

  // proposalCount stays on the core contract.
  const { data: proposalCount } = useReadContract({
    address: VAULTIS_ADDRESS,
    abi: VAULTIS_ABI,
    functionName: "proposalCount",
  });

  // Phase → CTA routing
  // Proposal → propose (submit an allocation proposal)
  // Voting   → vote    (cast your ballot)
  // Tally    → results (waiting for decryption)
  // Veto     → results (owner veto window open)
  // Executed → results (see approved allocations)
  const ctaHref =
    phase === "Voting"
      ? "/vote"
      : phase === "Tally" || phase === "Veto" || phase === "Executed"
      ? "/results"
      : "/propose";

  const ctaLabel =
    phase === "Voting"
      ? "cast your vote"
      : phase === "Tally"
      ? "results pending"
      : phase === "Veto"
      ? "veto window open"
      : phase === "Executed"
      ? "see allocations"
      : "submit a proposal";

  return (
    <div className="min-h-screen bg-fhenix-bg text-fhenix-white flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 relative overflow-hidden">
        {/* Background grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#0ad9dc 1px, transparent 1px), linear-gradient(90deg, #0ad9dc 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Radial glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-fhenix-cyan/5 blur-[120px] pointer-events-none" />

        {/* Eyebrow */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.3em] text-fhenix-cyan/60 border border-fhenix-navy px-4 py-1.5"
        >
          <Lock size={9} />
          FHE ENCRYPTED · TOKEN-WEIGHTED · ON-CHAIN
        </motion.div>

        {/* Title */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="relative mb-6 select-none text-center"
        >
          <h1 className="text-7xl md:text-9xl font-mono font-bold tracking-tighter text-fhenix-white leading-none">
            VAULTIS
          </h1>

          {/* Glitch layers */}
          <div
            className="absolute inset-0 flex flex-col items-center pointer-events-none"
            aria-hidden
          >
            <span className="text-7xl md:text-9xl font-mono font-bold tracking-tighter text-fhenix-orange opacity-10 translate-x-[3px] -translate-y-[2px] leading-none">
              VAULTIS
            </span>
          </div>
        </motion.div>

        {/* Taglines */}
        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-fhenix-white/60 text-sm md:text-base max-w-sm text-center mb-2 leading-relaxed font-mono"
        >
          Private DAO treasury management.
        </motion.p>
        <motion.p
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-fhenix-muted text-xs md:text-sm max-w-xs text-center mb-14 leading-relaxed"
        >
          The market can&apos;t front-run what it can&apos;t see.{" "}
          <span className="text-fhenix-purple/70">
            Runway, allocations, and unlocks — encrypted on-chain.
          </span>
        </motion.p>

        {/* ── How It Works ─────────────────────────────── */}
        <motion.section
          custom={7}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="w-full max-w-4xl mt-32 mb-8"
        >
          {/* Section label */}
          <div className="flex items-center gap-4 mb-10">
            <div className="h-px flex-1 bg-fhenix-navy" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-fhenix-cyan/40">
              HOW IT WORKS
            </span>
            <div className="h-px flex-1 bg-fhenix-navy" />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0 border border-fhenix-navy bg-fhenix-card">
            {[
              {
                step: "01",
                title: "Propose",
                desc: "Submit an allocation proposal — recipient, token, unlock date. Rationale is public; amount is encrypted.",
                phase: "Proposal",
              },
              {
                step: "02",
                title: "Vote",
                desc: "Token holders vote FOR or AGAINST. Weight is your balance, FHE-encrypted on-chain.",
                phase: "Voting",
              },
              {
                step: "03",
                title: "Tally",
                desc: "Votes are computed homomorphically. Individual positions stay invisible, forever.",
                phase: "Tally",
              },
              {
                step: "04",
                title: "Veto",
                desc: "A short owner-only window to block bad-faith proposals before execution.",
                phase: "Veto",
              },
              {
                step: "05",
                title: "Execute",
                desc: "Approved allocations are published on-chain. Quorum + majority, decided transparently.",
                phase: "Executed",
              },
            ].map(({ step, title, desc, phase: stepPhase }, i, arr) => (
              <div key={step} className="flex">
                <div
                  className={`flex flex-col px-6 py-8 gap-3 flex-1 transition-colors duration-300 ${
                    phase === stepPhase ? "bg-fhenix-cyan/5" : ""
                  }`}
                >
                  {/* Step number */}
                  <span className="text-[10px] font-mono text-fhenix-cyan/30 tracking-[0.3em]">
                    {step}
                  </span>

                  {/* Active indicator */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-fhenix-white tracking-wide">
                      {title}
                    </span>
                    {phase === stepPhase && (
                      <span className="w-1.5 h-1.5 rounded-full bg-fhenix-cyan animate-pulse" />
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-fhenix-muted text-xs leading-relaxed">
                    {desc}
                  </p>
                </div>

                {/* Divider */}
                {i < arr.length - 1 && (
                  <div className="w-px bg-fhenix-navy self-stretch hidden md:block" />
                )}
              </div>
            ))}
          </div>

          {/* Bottom note */}
          <div className="mt-4 text-center text-[10px] font-mono text-fhenix-navy tracking-widest">
            POWERED BY FULLY HOMOMORPHIC ENCRYPTION · FHENIX PROTOCOL
          </div>
        </motion.section>

        {/* Stats */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex gap-0 mb-14 border border-fhenix-navy bg-fhenix-card"
        >
          {[
            {
              icon: <Vault size={13} />,
              value:
                proposalCount !== undefined ? proposalCount.toString() : "—",
              label: "PROPOSALS",
            },
            {
              icon: <ShieldCheck size={13} />,
              value: (phase as string) ?? "—",
              label: "PHASE",
            },
          ].map(({ icon, value, label }, i, arr) => (
            <div key={label} className="flex">
              <div className="flex flex-col items-center justify-center px-10 py-6 gap-2">
                <span className="text-fhenix-cyan/40">{icon}</span>
                <div className="text-2xl font-mono font-bold text-fhenix-white">
                  {value}
                </div>
                <div className="text-[10px] text-fhenix-muted tracking-[0.2em]">
                  {label}
                </div>
              </div>
              {i < arr.length - 1 && (
                <div className="w-px bg-fhenix-navy self-stretch" />
              )}
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <Link
            href={ctaHref}
            className="group relative inline-flex items-center gap-3 border border-fhenix-cyan text-fhenix-cyan px-10 py-3.5 text-xs font-mono tracking-[0.2em] hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-300"
          >
            {/* shimmer sweep */}
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
            <Lock size={11} />
            {ctaLabel.toUpperCase()}
          </Link>
        </motion.div>

        {/* Footer flavor */}
        <motion.div
          custom={6}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-20 flex items-center gap-3 text-fhenix-navy text-[10px] tracking-widest font-mono select-none"
        >
          <span>0x7a3f···e91c</span>
          <span className="w-1 h-1 rounded-full bg-fhenix-navy" />
          <span>FHE ENCRYPTED</span>
          <span className="w-1 h-1 rounded-full bg-fhenix-navy" />
          <span>SEPOLIA</span>
        </motion.div>
      </main>
    </div>
  );
}
