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
      className="w-full border-t border-fhenix-navy bg-fhenix-bg/50 backdrop-blur-sm px-6 py-6 mt-auto"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left Section — Brand / Copy */}
        <div className="flex items-center gap-2 text-fhenix-muted text-[10px] font-mono tracking-wider">
          <ShieldAlert size={12} className="text-fhenix-navy animate-pulse" />
          <span>
            © {new Date().getFullYear()} DARRK CLUB. ZERO-KNOWLEDGE LOGIC READY.
          </span>
        </div>

        {/* Right Section — Fhenix Attribution */}
        <a
          href="https://fhenix.io"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 border border-fhenix-navy/40 hover:border-fhenix-cyan/30 bg-fhenix-card/30 hover:bg-fhenix-card/60 px-3 py-1.5 transition-all duration-300 rounded-sm"
        >
          <span className="text-[10px] font-mono text-fhenix-muted tracking-widest group-hover:text-fhenix-white transition-colors duration-300">
            POWERED BY FHENIX
          </span>
          {/* Removed 'filter brightness-0 invert' */}
          <div className="relative w-16 h-4 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
            <Image
              src="/fhenix.png"
              alt="Fhenix Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </a>
      </div>
    </motion.footer>
  );
}
