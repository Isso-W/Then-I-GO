import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, User, Bell, Shield, Smartphone, HelpCircle, LogOut, ChevronRight, Moon, Sun, Monitor, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";
import type { UserProfile } from "../types";

const PROFILE_KEY = "userProfile";

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

type ThemeMode = "dark" | "light" | "auto";

const GENDER_OPTIONS: { value: 'male' | 'female' | 'other'; label: string; emoji: string }[] = [
  { value: "male", label: "男", emoji: "👦" },
  { value: "female", label: "女", emoji: "👧" },
  { value: "other", label: "保密", emoji: "🤫" },
];

export function SettingsScreen({ onBack, themeMode, onThemeChange, profile, onUpdateProfile }: {
  onBack: () => void;
  themeMode?: ThemeMode;
  onThemeChange?: (mode: ThemeMode) => void;
  profile?: UserProfile | null;
  onUpdateProfile?: (p: UserProfile) => void;
}) {
  const [mbtiOpen, setMbtiOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleMbtiSelect = (code: string) => {
    if (!profile) return;
    const updated = { ...profile, mbti: code };
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(updated)); } catch {}
    onUpdateProfile?.(updated);
    setMbtiOpen(false);
  };

  const handleProfileSave = (name: string, gender: 'male' | 'female' | 'other' | null) => {
    if (!profile) return;
    const updated = { ...profile, name: name || undefined, gender };
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(updated)); } catch {}
    onUpdateProfile?.(updated);
    setProfileOpen(false);
  };

  return (
    <AppLayout>
      <div className="absolute inset-0" style={{ backgroundColor: "var(--bg-base)" }} />

      <header className="absolute left-0 right-0 top-[60px] z-30 flex items-center px-6">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full active:scale-90"
          style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="ml-4 text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>设置</h1>
      </header>

      <main className="absolute inset-0 pt-[120px] px-6 overflow-y-auto no-scrollbar pb-10">
        <section className="mb-6">
          <h2 className="mb-3 px-1 text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>个人信息</h2>
          <Glass className="overflow-hidden">
            <SettingItem icon={<User size={18} />} label="个人资料" detail={profile?.name || "未设置"} onClick={() => setProfileOpen(true)} />
            <div className="mx-4 h-px bg-[var(--border-subtle)]" />
            <SettingItem icon={<Smartphone size={18} />} label="绑定手机" detail="138****8888" />
            <div className="mx-4 h-px bg-[var(--border-subtle)]" />
            <SettingItem
              icon={<span className="text-[16px]">🧠</span>}
              label="MBTI 人格"
              detail={profile?.mbti ?? "未设置"}
              onClick={() => setMbtiOpen(true)}
            />
          </Glass>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 px-1 text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>应用设置</h2>
          <Glass className="overflow-hidden">
            <SettingItemWithToggle icon={<Bell size={18} />} label="消息推送" defaultChecked />
            <div className="mx-4 h-px bg-[var(--border-subtle)]" />
            <div className="p-5">
              <div className="flex items-center gap-4 mb-3">
                <div style={{ color: "var(--text-muted)" }}><Moon size={18} /></div>
                <span className="text-[17px] font-medium" style={{ color: "var(--text-secondary)" }}>主题模式</span>
              </div>
              <div className="flex gap-2">
                {([
                  { mode: "light" as ThemeMode, icon: <Sun size={15} />, label: "白天" },
                  { mode: "dark" as ThemeMode, icon: <Moon size={15} />, label: "黑夜" },
                  { mode: "auto" as ThemeMode, icon: <Monitor size={15} />, label: "跟随时间" },
                ] as const).map((opt) => (
                  <button
                    key={opt.mode}
                    onClick={() => onThemeChange?.(opt.mode)}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-all ${
                      themeMode === opt.mode
                        ? "bg-[#6C5CFF] text-white shadow-[0_4px_12px_rgba(108,92,255,0.3)]"
                        : ""
                    }`}
                    style={themeMode !== opt.mode ? { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" } : undefined}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </Glass>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 px-1 text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>其他</h2>
          <Glass className="overflow-hidden">
            <SettingItem icon={<Shield size={18} />} label="隐私中心" />
            <div className="mx-4 h-px bg-[var(--border-subtle)]" />
            <SettingItem icon={<HelpCircle size={18} />} label="关于应用" detail="v1.2.0" />
          </Glass>
        </section>

        <motion.button
          whileTap={{ scale: 0.98 }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#FF4D64]/30 bg-[#FF4D64]/10 text-[16px] font-bold text-[#FF4D64] mb-10"
        >
          <LogOut size={18} /> 退出登录
        </motion.button>
      </main>

      <AnimatePresence>
        {mbtiOpen && (
          <MbtiPickerOverlay
            current={profile?.mbti}
            onSelect={handleMbtiSelect}
            onClose={() => setMbtiOpen(false)}
          />
        )}
        {profileOpen && (
          <ProfileEditorOverlay
            currentName={profile?.name}
            currentGender={profile?.gender}
            onSave={handleProfileSave}
            onClose={() => setProfileOpen(false)}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

function MbtiPickerOverlay({ current, onSelect, onClose }: {
  current?: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-[120] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 240 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80%] overflow-y-auto no-scrollbar rounded-t-[28px] border-t p-5 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[18px] font-black" style={{ color: "var(--text-primary)" }}>选择你的 MBTI</h2>
          <button onClick={onClose} className="rounded-full p-1.5 active:scale-90" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <p className="text-[12px] mb-5" style={{ color: "var(--text-muted)" }}>AI 会根据你的人格类型调整路线风格和文案语气</p>

        <div className="grid grid-cols-4 gap-2.5">
          {MBTI_TYPES.map((t, i) => {
            const selected = current === t.code;
            return (
              <motion.button
                key={t.code}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onSelect(t.code)}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-3 transition-colors ${
                  selected
                    ? "border-[#6C5CFF] bg-[#6C5CFF]/15"
                    : "border-transparent bg-white/[0.04] active:bg-white/[0.08]"
                }`}
              >
                <span className={`text-[14px] font-black tracking-wider ${selected ? "text-[#A98BFF]" : ""}`} style={selected ? undefined : { color: "var(--text-primary)" }}>
                  {t.code}
                </span>
                <span className={`text-[10px] ${selected ? "text-[#A98BFF]/80" : ""}`} style={selected ? undefined : { color: "var(--text-muted)" }}>
                  {t.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProfileEditorOverlay({ currentName, currentGender, onSave, onClose }: {
  currentName?: string;
  currentGender?: 'male' | 'female' | 'other' | null;
  onSave: (name: string, gender: 'male' | 'female' | 'other' | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName ?? "");
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(currentGender ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-[120] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 240 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-t-[28px] border-t p-5 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-black" style={{ color: "var(--text-primary)" }}>编辑个人资料</h2>
          <button onClick={onClose} className="rounded-full p-1.5 active:scale-90" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="mb-5">
          <label className="block text-[13px] font-bold mb-2" style={{ color: "var(--text-muted)" }}>昵称</label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入你的昵称"
            maxLength={20}
            className="w-full rounded-xl px-4 py-3 text-[16px] font-medium outline-none transition-colors focus:ring-2 focus:ring-[#6C5CFF]/40"
            style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}
          />
        </div>

        <div className="mb-6">
          <label className="block text-[13px] font-bold mb-2" style={{ color: "var(--text-muted)" }}>性别</label>
          <div className="flex gap-3">
            {GENDER_OPTIONS.map((opt) => {
              const selected = gender === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setGender(selected ? null : opt.value)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-bold transition-colors ${
                    selected
                      ? "border-[#6C5CFF] bg-[#6C5CFF]/15"
                      : "border-transparent active:bg-white/[0.08]"
                  }`}
                  style={{
                    border: `1px solid ${selected ? "#6C5CFF" : "var(--border-subtle)"}`,
                    backgroundColor: selected ? undefined : "var(--bg-input)",
                    color: selected ? "#A98BFF" : "var(--text-secondary)",
                  }}
                >
                  <span>{opt.emoji}</span>
                  {opt.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onSave(name.trim(), gender)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#6C5CFF] text-[16px] font-bold text-white shadow-[0_4px_16px_rgba(108,92,255,0.35)]"
        >
          <Check size={18} />
          保存
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function SettingItem({ icon, label, detail, onClick }: { icon: React.ReactNode; label: string; detail?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between p-5 transition-colors group" style={{ color: "var(--text-primary)" }}>
      <div className="flex items-center gap-4">
        <div className="group-hover:text-[#A98BFF] transition-colors" style={{ color: "var(--text-muted)" }}>{icon}</div>
        <span className="text-[17px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {detail && <span className="text-[15px]" style={{ color: "var(--text-muted)" }}>{detail}</span>}
        <ChevronRight size={18} style={{ color: "var(--text-faint)" }} />
      </div>
    </button>
  );
}

function SettingItemWithToggle({ icon, label, defaultChecked = false, checked: controlledChecked, onChange }: { icon: React.ReactNode; label: string; defaultChecked?: boolean; checked?: boolean; onChange?: () => void }) {
  const [internal, setInternal] = React.useState(defaultChecked);
  const isChecked = controlledChecked ?? internal;
  const toggle = onChange ?? (() => setInternal(!internal));
  return (
    <div className="flex w-full items-center justify-between p-5">
      <div className="flex items-center gap-4">
        <div style={{ color: "var(--text-muted)" }}>{icon}</div>
        <span className="text-[17px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <button
        onClick={toggle}
        className={`relative h-7 w-12 rounded-full p-1 transition-colors ${isChecked ? 'bg-[#6C5CFF]' : ''}`}
        style={isChecked ? undefined : { backgroundColor: "var(--bg-input)", boxShadow: `inset 0 0 0 1px var(--border-subtle)` }}
      >
        <motion.div
          animate={{ x: isChecked ? 20 : 0 }}
          className="h-5 w-5 rounded-full bg-white shadow-lg"
        />
      </button>
    </div>
  );
}
