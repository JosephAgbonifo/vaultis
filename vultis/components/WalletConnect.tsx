"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { motion } from "framer-motion";
import { Wallet, LogOut, Unplug } from "lucide-react";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <motion.span
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-fhenix-white border border-fhenix-navy bg-fhenix-card px-2.5 py-1"
        >
          <Wallet size={10} className="text-fhenix-cyan" />
          {address?.slice(0, 6)}
          <span className="text-fhenix-muted">···</span>
          {address?.slice(-4)}
        </motion.span>

        <motion.button
          onClick={() => disconnect()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-fhenix-orange/70 border border-fhenix-orange/20 hover:border-fhenix-orange/60 hover:text-fhenix-orange bg-transparent hover:bg-fhenix-orange/5 px-2.5 py-1 transition-all duration-200"
        >
          <LogOut size={10} />
          disconnect
        </motion.button>
      </div>
    );
  }

  return (
    <motion.button
      onClick={() => connect({ connector: connectors[0] })}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-fhenix-cyan border border-fhenix-cyan/40 hover:border-fhenix-cyan hover:bg-fhenix-cyan/5 px-3 py-1.5 transition-all duration-200"
    >
      <Unplug size={11} />
      connect wallet
    </motion.button>
  );
}
