"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      className="relative w-full bg-fhenix-bg/50 backdrop-blur-xl px-6 py-6 mt-auto"
    >
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent, rgba(34,211,238,0.25), rgba(167,139,250,0.25), transparent)",
        }}
      />

      <div className="max-w-7xl mx-auto  flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left Section — Brand / Copy */}
        <div className="flex items-center gap-2 text-fhenix-muted text-[10px]  tracking-wider">
          <ShieldAlert
            size={12}
            className="text-fhenix-cyan/40 animate-pulse"
          />
          <span>
            © {new Date().getFullYear()} VAULTIS. ZERO-KNOWLEDGE LOGIC READY.
          </span>
        </div>

        {/* Right Section — Fhenix Attribution */}
        <motion.a
          href="https://fhenix.io"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ y: -1 }}
          className="group flex items-center gap-2 rounded-full border border-white/10 hover:border-fhenix-cyan/40 bg-white/[0.02] hover:bg-white/[0.05] backdrop-blur-sm px-3 py-1.5 transition-all duration-300 hover:shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
        >
          <span className="text-[10px]  text-fhenix-muted tracking-widest group-hover:text-fhenix-white transition-colors duration-300">
            POWERED BY FHENIX
          </span>
          <div className="relative w-16 h-4 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
            <Image
              src="/fhenix.png"
              alt="Fhenix Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </motion.a>
      </div>
    </motion.footer>
  );
}
