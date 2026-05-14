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
    <nav className="absolute bottom-5 left-5 right-5 z-40 flex h-[76px] items-center justify-around rounded-3xl border border-white/10 bg-[#11132B]/90 text-white backdrop-blur-2xl">
      {items.map((it, i) => (
        <button 
          key={it.key} 
          onClick={() => onNavigate?.(it.key as ScreenType)} 
          className="relative flex h-full flex-1 flex-col items-center justify-center gap-1"
        >
          {i > 0 && <span className="absolute left-0 h-9 w-px bg-white/10" />}
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
    <header className="absolute left-6 right-6 top-[58px] z-30 flex items-center justify-between text-white">
      <h1 className="text-[25px] font-bold">{title}</h1>
      <div className="flex items-center gap-3">{right}</div>
    </header>
  );
}

export function TabBar({ tabs, active = 0, onChange }: { tabs: string[]; active?: number; onChange?: (i: number) => void }) {
  return (
    <div className="flex h-10 items-center rounded-xl border border-white/5 bg-[#11182F]/80 p-1 text-[13px] text-[#B8B8D0]">
      {tabs.map((t, i) => (
        <button 
          key={t} 
          onClick={() => onChange?.(i)}
          className={`relative flex-1 rounded-lg py-1.5 text-center transition-colors ${i === active ? "text-white" : ""}`}
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
