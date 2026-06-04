import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, ChevronRight, Palette, Mountain, Utensils, Flame,
  Users, Camera as CameraIcon, Gem, PiggyBank,
} from "lucide-react";
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

const INTERESTS = [
  { id: "art", icon: Palette, label: "文艺" },
  { id: "outdoor", icon: Mountain, label: "户外" },
  { id: "food", icon: Utensils, label: "美食" },
  { id: "busy", icon: Flame, label: "热闹" },
  { id: "family", icon: Users, label: "亲子" },
  { id: "photo", icon: CameraIcon, label: "拍照" },
  { id: "niche", icon: Gem, label: "小众" },
  { id: "budget", icon: PiggyBank, label: "省钱" },
];

export function OnboardingScreen({ onComplete }: { onComplete: (profile: UserProfile) => void }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [mbti, setMbti] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);

  const finish = (overrides?: Partial<UserProfile>) => {
    onComplete({
      mbti: overrides?.mbti !== undefined ? overrides.mbti : mbti,
      interests: overrides?.interests ?? interests,
      completedAt: Date.now(),
    });
  };

  const toggleInterest = (id: string) => {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <AppLayout>
      <div className="absolute inset-0 z-0" style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(108,92,255,0.18),transparent_60%)]" />
      </div>

      <div className="absolute inset-x-0 top-0 z-10 px-5 pt-14 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-8 rounded-full transition-all ${step >= 0 ? "bg-[#6C5CFF]" : "bg-[var(--bg-input)]"}`} />
          <div className={`h-1.5 w-8 rounded-full transition-all ${step >= 1 ? "bg-[#6C5CFF]" : "bg-[var(--bg-input)]"}`} />
        </div>
        <button
          onClick={() => finish({ mbti: null, interests: [] })}
          className="text-[12px] font-bold text-[var(--text-muted)] active:scale-95 transition-all"
        >
          全部跳过
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="mbti"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-[5] flex flex-col pt-24 px-5 pb-32"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6C5CFF]/10 border border-[#6C5CFF]/20 text-[10px] font-bold tracking-widest text-[#A98BFF] mb-3">
                <Sparkles size={11} /> 第 1 步 / 共 2 步
              </div>
              <h1 className="text-2xl font-black italic text-white">你是哪一型？</h1>
              <p className="mt-1.5 text-[12px] text-[var(--text-muted)] font-medium">用 MBTI 帮 AI 写更对你胃口的探索故事</p>
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
                        : "bg-[var(--bg-input)] border-transparent"
                    }`}
                  >
                    <span className={`text-[13px] font-black tracking-wider ${mbti === t.code ? "text-[#A98BFF]" : "text-[var(--text-secondary)]"}`}>
                      {t.code}
                    </span>
                    <span className={`text-[10px] ${mbti === t.code ? "text-[#A98BFF]/80" : "text-[var(--text-muted)]"}`}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="interests"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-[5] flex flex-col pt-24 px-5 pb-32"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6C5CFF]/10 border border-[#6C5CFF]/20 text-[10px] font-bold tracking-widest text-[#A98BFF] mb-3">
                <Sparkles size={11} /> 第 2 步 / 共 2 步
              </div>
              <h1 className="text-2xl font-black italic text-white">你的口味偏好</h1>
              <p className="mt-1.5 text-[12px] text-[var(--text-muted)] font-medium">挑 3~5 个，AI 会优先推荐相关地点</p>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="grid grid-cols-2 gap-2.5">
                {INTERESTS.map((it) => {
                  const Icon = it.icon;
                  const on = interests.includes(it.id);
                  return (
                    <button
                      key={it.id}
                      onClick={() => toggleInterest(it.id)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                        on
                          ? "bg-[#6C5CFF]/20 border-[#6C5CFF] shadow-[0_0_18px_rgba(108,92,255,0.25)]"
                          : "bg-[var(--bg-input)] border-transparent"
                      }`}
                    >
                      <Icon size={20} className={on ? "text-[#A98BFF]" : "text-[var(--text-muted)]"} />
                      <span className={`text-[14px] font-bold ${on ? "text-white" : "text-[var(--text-muted)]"}`}>{it.label}</span>
                    </button>
                  );
                })}
              </div>
              {interests.length > 0 && (
                <p className="mt-4 text-center text-[11px] text-[var(--text-muted)]">已选 {interests.length} 个</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部按钮区 */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-10 pt-3 bg-gradient-to-t from-[#05070A] via-[#05070A] to-transparent">
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (step === 0) {
                setMbti(null);
                setStep(1);
              } else {
                finish({ interests: [] });
              }
            }}
            className="flex-1 rounded-full border py-3.5 text-[14px] font-bold text-[var(--text-muted)] active:scale-[0.98] transition-all"
            style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)" }}
          >
            跳过
          </button>
          <button
            onClick={() => {
              if (step === 0) setStep(1);
              else finish();
            }}
            className="flex-[1.5] flex items-center justify-center gap-2 rounded-full bg-[#6C5CFF] py-3.5 text-[14px] font-black text-white shadow-[0_10px_30px_rgba(108,92,255,0.4)] active:scale-[0.98] transition-all"
          >
            {step === 0 ? "下一步" : "开始探索"}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
