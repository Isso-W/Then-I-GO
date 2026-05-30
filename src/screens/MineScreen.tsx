import React, { useState } from "react";
import { Bell, Settings, Trophy, HelpCircle, Star, ChevronRight, Medal, TreePine, Moon, Briefcase, Coffee, Share2, Mail, MapPin, Sparkles, Gift, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";
import { BottomNav, PageTitle } from "../components/CommonUI";
import { ScreenType, UserProfile, GeneratedRoute } from "../types";

interface SysMessage { icon: React.ReactNode; title: string; desc: string; time: string }

export function MineScreen({ onNavigate, profile, generatedRoute }: { onNavigate: (s: ScreenType) => void; profile?: UserProfile | null; generatedRoute?: GeneratedRoute | null }) {
  const [showMessages, setShowMessages] = useState(false);

  // 系统消息：从当前 session 合成（今日路线 / 隐藏坐标 / 待领奖励 / MBTI 定制）+ 两条常驻提示
  const messages: SysMessage[] = [];
  if (generatedRoute) {
    messages.push({ icon: <MapPin size={18} />, title: "今日路线已就绪", desc: `${generatedRoute.title}（共 ${generatedRoute.waypoints.length} 站）`, time: "刚刚" });
    if (generatedRoute.hiddenTask) {
      messages.push({ icon: <Sparkles size={18} />, title: "发现隐藏坐标", desc: `「${generatedRoute.hiddenTask.name}」就在附近，去解锁`, time: "刚刚" });
    }
    const firstReward = generatedRoute.waypoints[0]?.reward;
    if (firstReward) {
      messages.push({ icon: <Gift size={18} />, title: "打卡奖励待领取", desc: `完成首站可得「${firstReward}」`, time: "今天" });
    }
  }
  if (profile?.mbti) {
    messages.push({ icon: <Star size={18} />, title: "已为你定制", desc: `按你的 ${profile.mbti} 偏好优化了今日选址`, time: "今天" });
  }
  messages.push({ icon: <Gift size={18} />, title: "优惠券提醒", desc: "你有未使用的优惠券，记得在到期前用掉", time: "1天前" });
  messages.push({ icon: <Bell size={18} />, title: "欢迎回到「那我走」", desc: "说走就走，剩下交给系统", time: "1天前" });

  return (
    <AppLayout>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_16%,rgba(255,209,102,.12),transparent_20%)]" />
      <PageTitle 
        title="我的" 
        right={
          <div className="flex gap-4">
            <button className="relative" onClick={() => setShowMessages(true)}>
              <Bell size={20} />
              {messages.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-[#FF4D64] rounded-full border border-[#0A0A1A]" />
              )}
            </button>
            <button onClick={() => onNavigate('settings')}>
              <Settings size={20} />
            </button>
          </div>
        } 
      />
      
      <main className="absolute inset-x-5 top-[100px] bottom-[104px] overflow-y-auto no-scrollbar pb-6">
        <div className="flex items-center gap-4 mt-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#6C5CFF]/60 bg-gradient-to-br from-[#FFD7BD] to-[#7B4B3A] text-4xl shadow-lg ring-4 ring-[#6C5CFF]/10">🧑🏻</div>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[20px] font-bold">那我走</div>
              {profile?.mbti && (
                <span className="rounded-full bg-[#6C5CFF]/20 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#A98BFF]">
                  {profile.mbti}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
               <span className="text-[12px] text-[#A98BFF] font-black uppercase">LV.12</span>
               <div className="h-1.5 w-[100px] rounded-full bg-white/10">
                 <motion.div initial={{ width: 0 }} animate={{ width: "62%" }} className="h-full rounded-full bg-[#6C5CFF]" />
               </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <FootprintMap />
        </div>
        
        <Glass className="mt-5 p-4 grid grid-cols-4 gap-2">
          <StatCard num="28" label="天数" />
          <StatCard num="86.3" label="公里" />
          <StatCard num="56" label="任务" />
          <StatCard num="26" label="礼券" />
        </Glass>
        
        <div className="mt-6 space-y-3">
          <MenuRow icon={<Mail size={20} />} label="系统消息" count={messages.length} onClick={() => setShowMessages(true)} />
          <MenuRow icon={<Share2 size={20} />} label="邀请好友" />
          <MenuRow icon={<HelpCircle size={20} />} label="帮助反馈" />
        </div>
      </main>
      <BottomNav active="mine" onNavigate={onNavigate} />

      <AnimatePresence>
        {showMessages && (
          <NotificationsOverlay messages={messages} onClose={() => setShowMessages(false)} />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

function NotificationsOverlay({ messages, onClose }: { messages: SysMessage[]; onClose: () => void }) {
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
        className="max-h-[70%] overflow-y-auto no-scrollbar rounded-t-[28px] border-t border-white/10 bg-[#0F172A] p-5 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-[#A98BFF]" />
            <h2 className="text-[17px] font-bold text-white">系统消息</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/5 p-1.5 text-white/50 active:scale-90">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2.5">
          {messages.map((m, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6C5CFF]/15 text-[#A98BFF]">
                {m.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold text-white truncate">{m.title}</span>
                  <span className="shrink-0 text-[10px] text-white/30">{m.time}</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FootprintMap() {
  return (
    <Glass className="relative h-[300px] overflow-hidden p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[19px] font-bold">我的足迹地图</div>
        <div className="text-[13px] font-medium px-2 py-0.5 rounded bg-[#6C5CFF]/20 text-[#A98BFF]">已解锁 36% 城区</div>
      </div>
      <div className="relative h-[210px] overflow-hidden rounded-2xl bg-[#07101D] border border-white/5 shadow-inner">
        {/* Map Background Grid */}
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(34deg,rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(124deg,rgba(255,255,255,.03)_1px,transparent_1px)] [background-size:40px_40px,56px_56px]" />
        
        {/* User Current Position */}
        <div className="absolute left-[138px] top-[148px] z-10">
          <motion.div 
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -inset-4 rounded-full bg-[#0B7DFF]/50 blur-md"
          />
          <div className="relative h-6 w-6 rounded-full bg-[#0B7DFF] ring-4 ring-[#0B7DFF]/30 shadow-[0_0_20px_#0B7DFF]" />
        </div>
        
        {/* History Markers */}
        {[[122,105],[160,86],[194,56],[230,32]].map(([x,y],i)=>(
          <motion.div 
            key={i} 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1 + i * 0.1 }}
            className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-[#FFD166] text-[#442A00] shadow-[0_0_16px_rgba(255,209,102,.8)] border border-white/20" 
            style={{left:x,top:y}}
          >
            <Star size={16} fill="#442A00" />
          </motion.div>
        ))}
        
        {/* Path Dots */}
        {[[135,124],[148,110],[174,75],[207,46]].map(([x,y],i)=>(
          <span key={i} className="absolute h-1.5 w-1.5 rounded-full bg-[#A98BFF]/60" style={{left:x,top:y}} />
        ))}
        
        {/* Unknown Areas */}
        {[[42,58],[270,128],[306,42]].map(([x,y],i)=>(
          <div key={i} className="absolute flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/20 font-bold text-xl" style={{left:x,top:y}}>?</div>
        ))}
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_60%,transparent_0,rgba(10,10,26,.3)_45%,rgba(10,10,26,.8)_100%)]" />
        
        <button className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-4 py-2 text-[12px] font-bold text-[#DCCFFF] border border-white/10 active:scale-95 transition-transform shadow-lg">
          查看全貌 <ChevronRight size={14} />
        </button>
      </div>
    </Glass>
  );
}

function StatCard({ num, label }: { num: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2 text-center border border-white/5">
      <div className="text-[17px] font-black font-mono text-[#DADAF0] leading-none">{num}</div>
      <div className="mt-1 text-[9px] text-white/30 uppercase tracking-tighter scale-90 font-bold">{label}</div>
    </div>
  );
}

function Badge({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2 group cursor-pointer w-14">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${color} shadow-lg border border-white/10 group-hover:scale-110 transition-transform`}>
        <div className="filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">{icon}</div>
      </div>
      <span className="text-[10px] text-white/50 text-center leading-tight h-8 px-1">{label}</span>
    </div>
  );
}

function MenuRow({ icon, label, count, onClick }: { icon: React.ReactNode; label: string; count?: number; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className="text-white/40 group-hover:text-[#A98BFF] transition-colors">{icon}</div>
        <span className="text-[17px] font-medium text-white/80">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {count && (
          <span className="bg-[#FF4D64] px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-[0_0_12px_rgba(255,77,100,0.4)]">
            {count}
          </span>
        )}
        <ChevronRight size={18} className="text-white/20 group-hover:text-white/40 transition-colors" />
      </div>
    </div>
  );
}
