"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  LogOut,
  Unplug,
  QrCode,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useState } from "react";

// Maps a wagmi connector id/name to an icon + friendly label.
// Falls back gracefully for any connector you add later.
function getConnectorMeta(id: string, name: string) {
  const key = id.toLowerCase();
  if (key.includes("walletconnect")) {
    return {
      icon: QrCode,
      label: "WalletConnect",
      hint: "Scan with any mobile wallet",
    };
  }
  if (key.includes("coinbase")) {
    return {
      icon: Wallet,
      label: "Coinbase Wallet",
      hint: "Connect via Coinbase",
    };
  }
  if (
    key.includes("injected") ||
    key.includes("metamask") ||
    key.includes("io.metamask")
  ) {
    return {
      icon: Wallet,
      label: name || "Browser Wallet",
      hint: "Connect installed extension",
    };
  }
  return { icon: Unplug, label: name, hint: "Connect via " + name };
}

function ConnectModal({ onClose }: { onClose: () => void }) {
  const { connect, connectors, isPending } = useConnect();
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const handleConnect = (connector: (typeof connectors)[number]) => {
    setPendingUid(connector.uid);
    connect(
      { connector },
      {
        onSettled: () => setPendingUid(null),
      }
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        key="connect-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md px-4"
        onClick={onClose}
      >
        <motion.div
          key="connect-modal"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-fhenix-bg/80 backdrop-blur-2xl p-6 flex flex-col gap-4 shadow-[0_0_60px_-15px_rgba(34,211,238,0.35)]"
        >
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent, #22d3ee, #a78bfa, transparent)",
            }}
          />

          <div>
            <div className="text-[10px]  tracking-[0.3em] text-fhenix-cyan/50 mb-1">
              CONNECT WALLET
            </div>
            <p className="text-xs  text-fhenix-muted leading-relaxed">
              Choose how you want to connect. WalletConnect works across any
              device — scan the QR with your phone&apos;s wallet app.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {connectors.map((connector) => {
              const meta = getConnectorMeta(connector.id, connector.name);
              const Icon = meta.icon;
              const connecting = isPending && pendingUid === connector.uid;

              return (
                <motion.button
                  key={connector.uid}
                  onClick={() => handleConnect(connector)}
                  disabled={isPending}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-fhenix-cyan/[0.06] hover:border-fhenix-cyan/40 px-4 py-3 text-left transition-all duration-200 disabled:opacity-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] group-hover:border-fhenix-cyan/40 group-hover:shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)] transition-all duration-200">
                    {connecting ? (
                      <Loader2
                        size={14}
                        className="animate-spin text-fhenix-cyan"
                      />
                    ) : (
                      <Icon
                        size={15}
                        className="text-fhenix-white/70 group-hover:text-fhenix-cyan transition-colors"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px]  tracking-wide text-fhenix-white group-hover:text-fhenix-cyan transition-colors">
                      {meta.label}
                    </div>
                    <div className="text-[9px]  text-fhenix-muted/60">
                      {connecting ? "Confirm in wallet…" : meta.hint}
                    </div>
                  </div>
                  <ChevronRight
                    size={13}
                    className="text-fhenix-muted/30 group-hover:text-fhenix-cyan/60 transition-colors"
                  />
                </motion.button>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-lg border border-white/5 text-fhenix-muted/50 py-2 text-[10px]  tracking-widest hover:text-fhenix-muted transition-all duration-200"
          >
            CANCEL
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [modalOpen, setModalOpen] = useState(false);

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <motion.span
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1.5 text-[10px]  tracking-widest text-fhenix-white rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-sm px-3 py-1.5"
        >
          <Wallet size={10} className="text-fhenix-cyan" />
          {address?.slice(0, 6)}
          <span className="text-fhenix-muted">···</span>
          {address?.slice(-4)}
        </motion.span>

        <motion.button
          onClick={() => disconnect()}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1.5 text-[10px]  tracking-widest text-fhenix-orange/70 rounded-full border border-fhenix-orange/20 hover:border-fhenix-orange/60 hover:text-fhenix-orange bg-transparent hover:bg-fhenix-orange/5 px-3 py-1.5 transition-all duration-200"
        >
          <LogOut size={10} />
          disconnect
        </motion.button>
      </div>
    );
  }

  return (
    <>
      <motion.button
        onClick={() => setModalOpen(true)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 text-[10px]  tracking-widest text-fhenix-cyan rounded-full border border-fhenix-cyan/40 hover:border-fhenix-cyan bg-fhenix-cyan/[0.04] hover:bg-fhenix-cyan/10 hover:shadow-[0_0_18px_-4px_rgba(34,211,238,0.7)] px-3.5 py-1.5 transition-all duration-200"
      >
        <Unplug size={11} />
        connect wallet
      </motion.button>

      {modalOpen && <ConnectModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
