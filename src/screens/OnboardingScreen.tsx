import React, { useState } from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { AppLayout } from "../components/Layout";
import type { UserProfile } from "../types";

// 16 型 MBTI + 中文别名
const MBTI_TYPES: { code: string; label: string }[] = [
  { code: "INTJ", label: "建筑师" },
  { code: "INTP", label: "逻辑学家" },
  { code: "ENTJ", label: "指挥官" },
  { code: "ENTP", label: "辩论家" },
  { code: "INFJ", label: "提倡者" },
  { code: "INFP", label: "调停者" },
  { code: "ENFJ", label: "主人公" },
  { code: "ENFP", label: "竞选者" },
  { code: "ISTJ", label: "物流师" },
  { code: "ISFJ", label: "守卫者" },
  { code: "ESTJ", label: "总经理" },
  { code: "ESFJ", label: "执政官" },
  { code: "ISTP", label: "鉴赏家" },
  { code: "ISFP", label: "探险家" },
  { code: "ESTP", label: "企业家" },
  { code: "ESFP", label: "表演者" },
];


export function OnboardingScreen({ onComplete }: { onComplete: (profile: UserProfile) => void }) {
  const [mbti, setMbti] = useState<string | null>(null);

  const finish = (overrides?: Partial<UserProfile>) => {
    onComplete({
      mbti: overrides?.mbti !== undefined ? overrides.mbti : mbti,
      interests: [],
      completedAt: Date.now(),
    });
  };

  return (
    <AppLayout>
      <div className="absolute inset-0 z-0" style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(108,92,255,0.18),transparent_60%)]" />
      </div>

      <div className="absolute inset-x-0 top-0 z-10 px-5 pt-14 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-8 rounded-full bg-[#6C5CFF]" />
        </div>
        <button
          onClick={() => finish({ mbti: null })}
          className="text-[12px] font-bold active:scale-95 transition-all"
          style={{ color: "var(--text-muted)" }}
        >
          跳过
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 z-[5] flex flex-col pt-24 px-5 pb-32"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black italic" style={{ color: "var(--text-primary)" }}>你是哪一型？</h1>
          <p className="mt-1.5 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>用 MBTI 帮 AI 写更对你胃口的探索故事</p>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="grid grid-cols-4 gap-2">
            {MBTI_TYPES.map((t) => (
              <button
                key={t.code}
                onClick={() => setMbti(t.code)}
                className={`flex flex-col items-center justify-center gap-0.5 py-3 px-1 rounded-2xl border-2 transition-all active:scale-95 ${
                  mbti === t.code
                    ? "bg-[#6C5CFF]/20 border-[#6C5CFF] shadow-[0_0_20px_rgba(108,92,255,0.3)]"
                    : "border-transparent"
                }`}
                style={mbti === t.code ? undefined : { backgroundColor: "var(--bg-input)" }}
              >
                <span
                  className={`text-[13px] font-black tracking-wider ${mbti === t.code ? "text-[#A98BFF]" : ""}`}
                  style={mbti === t.code ? undefined : { color: "var(--text-secondary)" }}
                >
                  {t.code}
                </span>
                <span
                  className={`text-[10px] ${mbti === t.code ? "text-[#A98BFF]/80" : ""}`}
                  style={mbti === t.code ? undefined : { color: "var(--text-faint)" }}
                >
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 底部按钮区 */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-10 pt-3" style={{ background: "linear-gradient(to top, var(--bg-base), var(--bg-base), transparent)" }}>
        <div className="flex gap-3">
          <button
            onClick={() => finish({ mbti: null })}
            className="flex-1 rounded-full border py-3.5 text-[14px] font-bold active:scale-[0.98] transition-all"
            style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}
          >
            跳过
          </button>
          <button
            onClick={() => finish()}
            className="flex-[1.5] flex items-center justify-center gap-2 rounded-full bg-[#6C5CFF] py-3.5 text-[14px] font-black text-white shadow-[0_10px_30px_rgba(108,92,255,0.4)] active:scale-[0.98] transition-all"
          >
            开始探索
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
