import React, { useState, useEffect } from "react";
import { HelpCircle, Utensils, Bike, Car, Coffee, Info, ChevronRight, Star, Gift, Clock, Smartphone, Battery, Umbrella, CreditCard } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";
import { BottomNav, PageTitle, TabBar } from "../components/CommonUI";
import { ScreenType, Coupon, GeneratedRoute } from "../types";

export function BagScreen({ onNavigate, generatedRoute }: { onNavigate: (s: ScreenType) => void; generatedRoute?: GeneratedRoute | null }) {
  const [activeTab, setActiveTab] = useState(0);
  const [gear, setGear] = useState<string[]>([]);

  useEffect(() => {
    const savedGear = localStorage.getItem('confirmedGear');
    if (savedGear) {
      setGear(JSON.parse(savedGear));
    }
  }, []);
  
  const demoCoupons: Coupon[] = [
    { title: "餐饮优惠券", desc: "满60减20", date: "06.01", amount: "¥20", icon: <Utensils size={20} />, color: "from-[#B46B08] to-[#654010]", tag: "限时" },
    { title: "单车骑行卡", desc: "7天畅骑卡", date: "05.28", amount: "¥3", icon: <Bike size={20} />, color: "from-[#00A99D] to-[#07566A]" },
    { title: "打车优惠券", desc: "最高减10元", date: "06.05", amount: "¥10", icon: <Car size={20} />, color: "from-[#006CDC] to-[#073B8C]" },
  ];
  // 今日路线赚到的奖励 → 优惠券（接真实 reward），叠在已有钱包之上
  const earnedColors = ["from-[#7C3AED] to-[#3B0F73]", "from-[#0EA5E9] to-[#075985]", "from-[#F59E0B] to-[#7C4A02]"];
  const earnedCoupons: Coupon[] = generatedRoute
    ? [
        ...generatedRoute.waypoints.map((wp, i) => ({
          title: wp.reward,
          desc: `来自「${wp.name}」`,
          date: "本周",
          amount: "领",
          icon: <Gift size={20} />,
          color: earnedColors[i % earnedColors.length],
          tag: "今日",
        })),
        ...(generatedRoute.hiddenTask
          ? [{
              title: generatedRoute.hiddenTask.reward,
              desc: `隐藏任务：${generatedRoute.hiddenTask.name}`,
              date: "本周",
              amount: "领",
              icon: <Star size={20} />,
              color: "from-[#B45309] to-[#7C2D12]",
              tag: "隐藏",
            }]
          : []),
      ]
    : [];
  const coupons: Coupon[] = [...earnedCoupons, ...demoCoupons];

  const items = [
    { title: "能量棒", desc: "恢复 20 能量", count: 3, icon: "🧀", rarity: "普通" },
    { title: "追踪器", desc: "显示隐藏任务", count: 1, icon: "🧭", rarity: "稀有" },
  ];

  const gearMap: Record<string, { label: string, icon: any, desc: string }> = {
    phone: { label: "手机", icon: Smartphone, desc: "已充电 100%" },
    battery: { label: "充电宝", icon: Battery, desc: "20000mAh" },
    umbrella: { label: "雨伞", icon: Umbrella, desc: "折叠便携" },
    id_card: { label: "身份证", icon: CreditCard, desc: "有效证件" },
  };

  return (
    <AppLayout>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(108,92,255,.12),transparent_25%)]" />
      <PageTitle 
        title="背包" 
        right={
          <button className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80">
            兑换记录
          </button>
        } 
      />
      
      <main className="absolute inset-x-4 top-[100px] bottom-[104px] overflow-y-auto no-scrollbar pb-6 px-1">
        <TabBar tabs={["优惠券", "道具", "装备"]} active={activeTab} onChange={setActiveTab} />
        
        <AnimatePresence mode="wait">
          {activeTab === 0 && (
            <motion.div 
              key="coupons" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
            >
              <Glass className="mt-5 flex items-center justify-between p-4 border-l-4 border-l-[#FFD166] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <Star size={60} className="fill-white" />
                </div>
                <div className="relative z-10">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">可用资产</p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[28px] font-black text-[#FFD166]">{coupons.length}</span>
                    <span className="text-[13px] font-bold text-white/50">张优惠券</span>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFD166]/10 text-[#FFD166]">
                  <Gift size={24} />
                </div>
              </Glass>
              
              <div className="mt-5 space-y-4">
                {coupons.map((c, idx) => <CouponCard key={c.title} {...c} index={idx} />)}
              </div>
            </motion.div>
          )}
          
          {activeTab === 1 && (
            <motion.div 
              key="items" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }} 
              className="mt-5 grid grid-cols-2 gap-3"
            >
              {items.map((it, idx) => <ItemCard key={it.title} {...it} index={idx} />)}
            </motion.div>
          )}
          
          {activeTab === 2 && (
            <motion.div 
              key="gear" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
            >
              {gear.length > 0 ? (
                <div className="mt-5 grid grid-cols-1 gap-3">
                  {gear.map((id, idx) => {
                    const item = gearMap[id];
                    if (!item) return null;
                    return (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6C5CFF]/20 text-[#6C5CFF]">
                          <item.icon size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="text-[15px] font-black text-white">{item.label}</div>
                          <div className="text-[11px] text-white/40">{item.desc}</div>
                        </div>
                        <div className="rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] font-bold text-green-500">已就绪</div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-20 flex flex-col items-center justify-center text-center opacity-40 px-10">
                  <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Battery size={32} />
                  </div>
                  <h3 className="text-[16px] font-bold">暂无装备</h3>
                  <p className="mt-2 text-[12px]">开始今日路线前确认装备，确保持续探索</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav active="bag" onNavigate={onNavigate} />
    </AppLayout>
  );
}

interface CouponCardProps extends Coupon {
  index: number;
  key?: string | number;
}

function CouponCard({ title, desc, date, amount, icon, color, tag, index }: CouponCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex h-[82px] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r ${color} shadow-lg cursor-pointer`}
    >
      <div className="flex w-[64px] items-center justify-center bg-black/20">
        <div className="text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]">
          {icon}
        </div>
      </div>
      
      <div className="flex flex-1 flex-col justify-center px-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[15px] font-bold text-white tracking-tight leading-none">{title}</span>
          {tag && <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[8px] font-black text-white uppercase tracking-tighter">{tag}</span>}
        </div>
        <div className="mt-1 text-[11px] font-medium text-white/80">{desc}</div>
        <div className="mt-1 flex items-center gap-1 text-[9px] text-white/50">
          <Clock size={9} />
          {date} 到期
        </div>
      </div>

      <div className="relative flex w-[76px] flex-col items-center justify-center bg-white/5 backdrop-blur-md">
        <div className="absolute top-1/2 -left-[1px] -translate-y-1/2 flex flex-col gap-0.5 opacity-20">
           {Array.from({ length: 5 }).map((_, i) => (
             <div key={i} className="h-1.5 w-0.5 bg-white rounded-full" />
           ))}
        </div>
        <div className="text-[22px] font-black text-white leading-none">{amount}</div>
        <div className="mt-1 text-[9px] font-bold text-white/60 uppercase tracking-tighter">立即用</div>
      </div>

      {/* Ticket Punches */}
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[#0A0A1A] border border-white/5" />
      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[#0A0A1A] border border-white/5" />
    </motion.div>
  );
}

interface ItemCardProps {
  title: string;
  desc: string;
  count: number;
  icon: string;
  rarity: string;
  index: number;
  key?: string | number;
}

function ItemCard({ title, desc, count, icon, rarity, index }: ItemCardProps) {
  const isRare = rarity === '稀有';
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      whileTap={{ scale: 0.95 }}
      className={`flex flex-col rounded-2xl border ${isRare ? 'border-[#FFD166]/30 bg-[#FFD166]/5' : 'border-white/10 bg-white/[0.03]'} p-3.5 relative overflow-hidden group transition-all cursor-pointer`}
    >
      <div className="absolute -top-6 -right-6 h-12 w-12 rounded-full bg-white/5 blur-xl group-hover:bg-[#6C5CFF]/20 transition-colors" />
      
      <div className={`text-[9px] font-black uppercase tracking-tighter self-start px-2 py-0.5 rounded-full mb-3 ${
        isRare ? 'bg-[#FFD166] text-black' : 'bg-white/10 text-white/40'
      }`}>
        {rarity}
      </div>
      
      <div className="text-4xl my-2 flex justify-center drop-shadow-lg group-hover:scale-110 transition-transform">{icon}</div>
      
      <div className="mt-1">
        <div className="text-[15px] font-black text-white/90 truncate">{title}</div>
        <p className="mt-0.5 text-[10px] text-white/40 leading-tight line-clamp-2 h-6">{desc}</p>
      </div>
      
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] font-bold text-white/30 tracking-tight">存量 {count}</span>
        <div className={`h-6 w-6 rounded-lg flex items-center justify-center transition-colors ${
          isRare ? 'bg-[#FFD166]/20 text-[#FFD166]' : 'bg-white/5 text-white/40'
        }`}>
          <ChevronRight size={14} />
        </div>
      </div>
    </motion.div>
  );
}
