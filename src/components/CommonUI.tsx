import React from "react";
import { Footprints, BookOpen, Backpack, Smile } from "lucide-react";
import { motion } from "motion/react";
import { ScreenType } from "../types";

export function BottomNav({ active, onNavigate }: { active: ScreenType; onNavigate: (s: ScreenType) => void }) {
  const items = [
    { key: "explore", name: "探索", icon: <Footprints size={23} /> },
    { key: "story", name: "故事", icon: <BookOpen size={23} /> },
    { key: "bag", name: "背包", icon: <Backpack size={23} /> },
    { key: "mine", name: "我的", icon: <Smile size={24} />, dot: true },
  ];

  return (
    <nav className="absolute bottom-5 left-5 right-5 z-40 flex h-[76px] items-center justify-around rounded-3xl border backdrop-blur-2xl" style={{ backgroundColor: "var(--bg-nav)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
      {items.map((it, i) => (
        <button 
          key={it.key} 
          onClick={() => onNavigate?.(it.key as ScreenType)} 
          className="relative flex h-full flex-1 flex-col items-center justify-center gap-1"
        >
          {i > 0 && <span className="absolute left-0 h-9 w-px" style={{ backgroundColor: "var(--border-subtle)" }} />}
          {it.dot && <span className="absolute right-8 top-3 h-2.5 w-2.5 rounded-full bg-[#FF4D64]" />}
          <motion.div 
            whileTap={{ scale: 0.9 }}
            className={active === it.key ? "text-[#A98BFF] drop-shadow-[0_0_14px_rgba(108,92,255,.95)]" : "text-[#C7BCE7]/65"}
          >
            {it.icon}
          </motion.div>
          <span className={`text-[12px] ${active === it.key ? "text-[#A98BFF]" : "text-[#C7BCE7]/65"}`}>{it.name}</span>
          {active === it.key && (
            <motion.div 
              layoutId="nav-glow"
              className="absolute inset-0 bg-[#A98BFF]/5 blur-xl"
            />
          )}
        </button>
      ))}
    </nav>
  );
}

export function PageTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <header className="absolute left-6 right-6 top-[58px] z-30 flex items-center justify-between" style={{ color: "var(--text-primary)" }}>
      <h1 className="text-[25px] font-bold">{title}</h1>
      <div className="flex items-center gap-3">{right}</div>
    </header>
  );
}

export function TabBar({ tabs, active = 0, onChange }: { tabs: string[]; active?: number; onChange?: (i: number) => void }) {
  return (
    <div className="flex h-10 items-center rounded-xl border p-1 text-[13px]" style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
      {tabs.map((t, i) => (
        <button 
          key={t} 
          onClick={() => onChange?.(i)}
          className={`relative flex-1 rounded-lg py-1.5 text-center transition-colors`}
          style={i === active ? { color: "var(--text-primary)" } : undefined}
        >
          {t}
          {i === active && (
            <motion.span 
              layoutId="tab-underline"
              className="absolute bottom-0 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-[#6C5CFF]" 
            />
          )}
        </button>
      ))}
    </div>
  );
}
