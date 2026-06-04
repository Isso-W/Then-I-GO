import React from "react";
import { motion, AnimatePresence } from "motion/react";

interface PhoneShellProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: PhoneShellProps) {
  return (
    <div className="relative h-full w-full max-w-[500px] mx-auto overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Status Bar Area (Simplified for Web) */}
      <div className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-7 pt-4 pointer-events-none" style={{ color: "var(--text-primary)" }}>
        <div className="text-[14px] font-semibold">{new Date().getHours().toString().padStart(2, "0")}:{new Date().getMinutes().toString().padStart(2, "0")}</div>
        <div className="flex items-center gap-1.5 opacity-80">
          <div className="flex h-3 items-end gap-[2px]">
            <span className="h-1.5 w-0.5 rounded-full" style={{ backgroundColor: "var(--text-primary)" }} />
            <span className="h-2 w-0.5 rounded-full" style={{ backgroundColor: "var(--text-primary)" }} />
            <span className="h-2.5 w-0.5 rounded-full" style={{ backgroundColor: "var(--text-primary)" }} />
            <span className="h-3 w-0.5 rounded-full" style={{ backgroundColor: "var(--text-primary)" }} />
          </div>
          <div className="h-3 w-5 rounded-sm relative" style={{ border: "1px solid var(--text-muted)" }}>
            <div className="absolute left-0 top-0 h-full w-3 rounded-sm" style={{ backgroundColor: "var(--text-primary)", opacity: 0.9 }} />
          </div>
        </div>
      </div>
      
      {/* Screen Content Wrapper */}
      <AnimatePresence mode="wait">
        <motion.div
           key="content"
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           transition={{ duration: 0.4 }}
           className="h-full w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Bottom Safe Area Barrier (Home Indicator) */}
      <div className="absolute bottom-1.5 left-1/2 z-50 h-1 w-32 -translate-x-1/2 rounded-full" style={{ backgroundColor: "var(--text-faint)" }} />
    </div>
  );
}

export function Glass({ children, className = "", onClick, style }: { children: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void; style?: React.CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)", color: "var(--text-primary)", ...style }}
      className={`rounded-2xl border backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,.08)] dark:shadow-[0_18px_50px_rgba(0,0,0,.35)] ${className}`}
    >
      {children}
    </motion.div>
  );
}
