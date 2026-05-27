"use client";

import Link from "next/link";
import { WalletConnect } from "./WalletConnect";
import { PhaseTag } from "./PhaseTag";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { motion } from "framer-motion";
import { BookLock } from "lucide-react";

export function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex items-center justify-between px-6 py-4 border-b border-fhenix-navy bg-fhenix-bg/80 backdrop-blur-md sticky top-0 z-50"
    >
      {/* Left — brand */}
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: -8, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="text-fhenix-cyan"
        >
          <BookLock size={18} strokeWidth={1.5} />
        </motion.div>

        <Link href="/" className="group flex items-center gap-3">
          <span className="text-xs font-mono font-bold tracking-[0.25em] text-fhenix-white group-hover:text-fhenix-cyan transition-colors duration-300">
            DARRK CLUB
          </span>
          <span className="hidden sm:inline text-[10px] font-mono text-fhenix-navy border border-fhenix-navy px-1.5 py-0.5 tracking-widest group-hover:border-fhenix-cyan/40 group-hover:text-fhenix-cyan/60 transition-all duration-300">
            ENCRYPTED
          </span>
        </Link>

        <div className="w-px h-4 bg-fhenix-navy mx-1" />
        <PhaseTag />
      </div>

      {/* Right — controls */}
      <div className="flex items-center gap-3">
        <NetworkSwitcher />
        <div className="w-px h-4 bg-fhenix-navy" />
        <WalletConnect />
      </div>
    </motion.nav>
  );
}
