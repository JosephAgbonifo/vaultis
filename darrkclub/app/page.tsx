"use client";

import Link from "next/link";
import { Navbar } from "@/components/NavBar";
import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, ABI } from "@/lib/contract";
import { motion } from "framer-motion";
import { BookOpen, Users, ShieldCheck, Lock } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function Home() {
  const { data: phase } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getPhase",
  });

  const { data: bookCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "bookCount",
  });

  const { data: memberCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "memberCount",
  });

  const ctaHref =
    phase === "Voting"
      ? "/vote"
      : phase === "Closed"
        ? "/results"
        : "/nominate";
  const ctaLabel =
    phase === "Voting"
      ? "cast your vote"
      : phase === "Closed"
        ? "see results"
        : "nominate a book";

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
          FHE ENCRYPTED · RANKED-CHOICE · ON-CHAIN
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
            DARRK
          </h1>
          <h1
            className="text-7xl md:text-9xl font-mono font-bold tracking-tighter leading-none"
            style={{ WebkitTextStroke: "1px #0ad9dc", color: "transparent" }}
          >
            CLUB
          </h1>

          {/* Glitch layers */}
          <div
            className="absolute inset-0 flex flex-col items-center pointer-events-none"
            aria-hidden
          >
            <span className="text-7xl md:text-9xl font-mono font-bold tracking-tighter text-fhenix-orange opacity-10 translate-x-[3px] -translate-y-[2px] leading-none">
              DARRK
            </span>
            <span className="text-7xl md:text-9xl font-mono font-bold tracking-tighter text-fhenix-indigo opacity-10 -translate-x-[3px] translate-y-[2px] leading-none">
              CLUB
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
          Anonymous encrypted book voting.
        </motion.p>
        <motion.p
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-fhenix-muted text-xs md:text-sm max-w-xs text-center mb-14 leading-relaxed"
        >
          Nobody knows who nominated what.{" "}
          <span className="text-fhenix-purple/70">
            The introvert&apos;s book finally gets read.
          </span>
        </motion.p>

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
              icon: <BookOpen size={13} />,
              value: bookCount?.toString() ?? "—",
              label: "BOOKS",
            },
            {
              icon: <Users size={13} />,
              value: memberCount?.toString() ?? "—",
              label: "MEMBERS",
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
          <span>BASE SEPOLIA</span>
        </motion.div>
      </main>
    </div>
  );
}
