import React from "react";
import { ArrowLeft, User, Bell, Shield, Smartphone, HelpCircle, LogOut, ChevronRight, Moon, Globe, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <AppLayout>
      <div className="absolute inset-0 bg-[#0A0A1A]" />
      
      <header className="absolute left-0 right-0 top-[60px] z-30 flex items-center px-6">
        <button 
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white active:scale-90"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="ml-4 text-[20px] font-bold text-white">设置</h1>
      </header>

      <main className="absolute inset-0 pt-[120px] px-6 overflow-y-auto no-scrollbar pb-10">
        <section className="mb-6">
          <h2 className="mb-3 px-1 text-[12px] font-bold uppercase tracking-widest text-white/30">个人信息</h2>
          <Glass className="overflow-hidden">
            <SettingItem icon={<User size={18} />} label="个人资料" detail="那我走" />
            <div className="mx-4 h-px bg-white/5" />
            <SettingItem icon={<Smartphone size={18} />} label="绑定手机" detail="138****8888" />
          </Glass>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 px-1 text-[12px] font-bold uppercase tracking-widest text-white/30">应用设置</h2>
          <Glass className="overflow-hidden">
            <SettingItemWithToggle icon={<Bell size={18} />} label="消息推送" defaultChecked />
            <div className="mx-4 h-px bg-white/5" />
            <SettingItemWithToggle icon={<Moon size={18} />} label="夜间模式" defaultChecked />
          </Glass>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 px-1 text-[12px] font-bold uppercase tracking-widest text-white/30">其他</h2>
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
    <button className="flex w-full items-center justify-between p-5 hover:bg-white/5 transition-colors group">
      <div className="flex items-center gap-4">
        <div className="text-white/40 group-hover:text-[#A98BFF] transition-colors">{icon}</div>
        <span className="text-[17px] text-white/90 font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {detail && <span className="text-[15px] text-white/40">{detail}</span>}
        <ChevronRight size={18} className="text-white/20 group-hover:text-white/40 transition-colors" />
      </div>
    </button>
  );
}

function SettingItemWithToggle({ icon, label, defaultChecked = false }: { icon: React.ReactNode; label: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = React.useState(defaultChecked);
  return (
    <div className="flex w-full items-center justify-between p-5">
      <div className="flex items-center gap-4">
        <div className="text-white/40">{icon}</div>
        <span className="text-[17px] text-white/90 font-medium">{label}</span>
      </div>
      <button 
        onClick={() => setChecked(!checked)}
        className={`relative h-7 w-12 rounded-full p-1 transition-colors ${checked ? 'bg-[#6C5CFF]' : 'bg-white/10 ring-1 ring-white/10'}`}
      >
        <motion.div 
          animate={{ x: checked ? 20 : 0 }}
          className="h-5 w-5 rounded-full bg-white shadow-lg" 
        />
      </button>
    </div>
  );
}
