import React from "react";
import { ArrowLeft, User, Bell, Shield, Smartphone, HelpCircle, LogOut, ChevronRight, Moon, Globe, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";

export function SettingsScreen({ onBack, theme, onToggleTheme }: { onBack: () => void; theme?: "dark" | "light"; onToggleTheme?: () => void }) {
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
            <SettingItem icon={<User size={18} />} label="个人资料" detail="那我走" />
            <div className="mx-4 h-px bg-white/5" />
            <SettingItem icon={<Smartphone size={18} />} label="绑定手机" detail="138****8888" />
          </Glass>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 px-1 text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>应用设置</h2>
          <Glass className="overflow-hidden">
            <SettingItemWithToggle icon={<Bell size={18} />} label="消息推送" defaultChecked />
            <div className="mx-4 h-px bg-white/5" />
            <SettingItemWithToggle icon={<Moon size={18} />} label="夜间模式" checked={theme !== "light"} onChange={onToggleTheme} />
          </Glass>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 px-1 text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>其他</h2>
          <Glass className="overflow-hidden">
            <SettingItem icon={<Shield size={18} />} label="隐私中心" />
            <div className="mx-4 h-px bg-white/5" />
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
    </AppLayout>
  );
}

function SettingItem({ icon, label, detail }: { icon: React.ReactNode; label: string; detail?: string }) {
  return (
    <button className="flex w-full items-center justify-between p-5 transition-colors group" style={{ color: "var(--text-primary)" }}>
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
