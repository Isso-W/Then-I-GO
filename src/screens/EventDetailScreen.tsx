import React from "react";
import { X, Sparkles, Gift, ChevronRight, Star, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";

export function EventDetailScreen({ onBack }: { onBack: () => void }) {
  return (
    <AppLayout>
      <div className="absolute inset-0" style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,#3B3BB044,transparent_70%)]" />
        <div className="absolute inset-0 overflow-hidden">
           {Array.from({ length: 15 }).map((_, i) => (
             <motion.div
               key={i}
               initial={{ opacity: 0 }}
               animate={{ opacity: [0, 0.5, 0], y: [0, -100] }}
               transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 5 }}
               className="absolute h-1 w-1 bg-white rounded-full blur-[1px]"
               style={{ left: `${Math.random() * 100}%`, top: `${70 + Math.random() * 30}%` }}
             />
           ))}
        </div>
      </div>

      <header className="absolute left-0 right-0 top-[60px] z-30 flex items-center justify-between px-6">
        <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md active:scale-90" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}>
          <X size={20} />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-[#FFD166]/30 bg-[#FFD166]/10 px-3 py-1.5 text-[var(--accent-gold)]">
          <AlertCircle size={16} />
          <span className="text-[12px] font-bold">14:59</span>
        </div>
      </header>

      <main className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center pt-10">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative mb-8">
          <div className="relative z-10 flex h-40 w-40 items-center justify-center rounded-full border shadow-[0_0_60px_rgba(108,92,255,0.3)]" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-card)" }}>
            <div className="text-7xl drop-shadow-[0_0_20px_rgba(255,209,102,0.8)]">🧧</div>
          </div>
          <motion.div animate={{ scale: [1, 1.4], opacity: [0.3, 0] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 rounded-full bg-[#FFD166]/30 blur-2xl" />
        </motion.div>

        <h1 className="text-[28px] font-black italic tracking-tighter" style={{ color: "var(--text-primary)" }}>{"触发：城市盲盒"}</h1>
        <p className="mt-2 text-[15px]" style={{ color: "var(--text-secondary)" }}>{"你在长宁区某条无名小巷内发现了一份\"惊喜\""}</p>

        <div className="mt-10 w-full space-y-3">
          <EventAction icon={<Sparkles size={20} className="text-[var(--accent-gold)]" />} title="立即开启" subtitle="消耗 10 能量" color="bg-gradient-to-r from-[#6C5CFF] to-[#8F5CFF]" />
          <EventAction icon={<Gift size={20} style={{ color: "var(--text-secondary)" }} />} title="稍后开启" subtitle="放入背包" color="bg-[var(--bg-input)]" borderSubtle />
        </div>
      </main>

      <div className="absolute bottom-[30px] left-6 right-6">
        <Glass className="p-4 text-left border border-[#FFD166]/20">
          <div className="flex items-center gap-2 mb-1 text-[var(--accent-gold)] text-[13px] font-bold">{"概率公示"}</div>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{"传说级：1.5% / 史诗：8.5% / 普通：90%"}</p>
        </Glass>
      </div>
    </AppLayout>
  );
}

function EventAction({ icon, title, subtitle, color, glow = "", borderSubtle = false }: { icon: React.ReactNode; title: string; subtitle: string; color: string; glow?: string; borderSubtle?: boolean }) {
  const isGradient = color.includes("gradient");
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`flex w-full items-center justify-between rounded-2xl p-6 ${color} ${glow} transition-shadow`}
      style={borderSubtle ? { borderWidth: 1, borderColor: "var(--border-subtle)" } : undefined}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/20 text-white">
          {icon}
        </div>
        <div className="text-left">
          <div className={`text-[19px] font-bold ${isGradient ? "text-white" : ""}`} style={isGradient ? undefined : { color: "var(--text-primary)" }}>{title}</div>
          <div className={`text-[13px] ${isGradient ? "text-white/60" : ""}`} style={isGradient ? undefined : { color: "var(--text-secondary)" }}>{subtitle}</div>
        </div>
      </div>
      <ChevronRight size={22} className={isGradient ? "text-white/50" : ""} style={isGradient ? undefined : { color: "var(--text-muted)" }} />
    </motion.button>
  );
}
