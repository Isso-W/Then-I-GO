import React, { useState, useEffect } from "react";
import { Utensils, Bike, Car, Gift, Star, Clock, Smartphone, Battery, Umbrella, CreditCard, X, ChevronRight, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AppLayout } from "../components/Layout";
import { BottomNav, PageTitle, TabBar } from "../components/CommonUI";
import { ScreenType, Coupon, GeneratedRoute, TripRecord } from "../types";
import { getCategoryImage } from "../lib/categoryImages";

function CouponImage({ src, emoji, className }: { src?: string; emoji?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className={`flex items-center justify-center bg-[var(--bg-input)] ${className}`}>
        <span className="text-2xl">{emoji || "🎁"}</span>
      </div>
    );
  }
  return (
    <img src={src} alt="" className={`object-cover ${className}`} onError={() => setFailed(true)} />
  );
}

const COUPON_FILTERS = ["全部", "美食", "出行", "娱乐", "其他"] as const;

function filterTag(title: string, desc: string): string {
  if (/餐|面|食|火锅|烧烤|奶茶|咖啡|甜品/.test(title + desc)) return "美食";
  if (/单车|骑行|打车|出行/.test(title + desc)) return "出行";
  if (/电影|KTV|密室|桌游|游戏/.test(title + desc)) return "娱乐";
  return "其他";
}

export function BagScreen({ onNavigate, generatedRoute }: { onNavigate: (s: ScreenType) => void; generatedRoute?: GeneratedRoute | null }) {
  const [activeTab, setActiveTab] = useState(0);
  const [couponFilter, setCouponFilter] = useState<string>("全部");
  const [gear, setGear] = useState<string[]>([]);
  const [tripHistory, setTripHistory] = useState<TripRecord[]>([]);

  useEffect(() => {
    const savedGear = localStorage.getItem('confirmedGear');
    if (savedGear) setGear(JSON.parse(savedGear));
    const savedHistory = localStorage.getItem('tripHistory');
    if (savedHistory) setTripHistory(JSON.parse(savedHistory));
  }, []);

  const demoCoupons: (Coupon & { filterTag: string })[] = [
    {
      title: "6.9元牛肉面套餐", desc: "三杯牛肉面馆 · 招牌套餐", date: "06.15", amount: "¥6.9",
      icon: <Utensils size={18} />, color: "from-[#B46B08] to-[#654010]", tag: "限时",
      image: "/categories/noodles.jpg", filterTag: "美食",
    },
    {
      title: "餐饮优惠券", desc: "满60减20 · 全场通用", date: "06.10", amount: "¥20",
      icon: <Utensils size={18} />, color: "from-[#B46B08] to-[#654010]", tag: "限时",
      image: "/categories/food.jpg", filterTag: "美食",
    },
    {
      title: "单车骑行卡", desc: "7天畅骑卡 · 不限次", date: "06.08", amount: "¥3",
      icon: <Bike size={18} />, color: "from-[#00A99D] to-[#07566A]",
      image: "/categories/bike.jpg", filterTag: "出行",
    },
    {
      title: "打车优惠券", desc: "满30减10 · 全城可用", date: "06.12", amount: "¥10",
      icon: <Car size={18} />, color: "from-[#006CDC] to-[#073B8C]",
      image: "/categories/taxi.jpg", filterTag: "出行",
    },
  ];

  const earnedCoupons: (Coupon & { filterTag: string })[] = generatedRoute
    ? [
        ...generatedRoute.waypoints.map((wp) => ({
          title: wp.reward,
          desc: `来自「${wp.name}」`,
          date: "本周",
          amount: "领",
          icon: <Gift size={18} />,
          color: "from-[#7C3AED] to-[#3B0F73]",
          tag: "今日",
          image: getCategoryImage(wp.category),
          filterTag: filterTag(wp.reward, wp.name),
        })),
        ...(generatedRoute.hiddenTask
          ? [{
              title: generatedRoute.hiddenTask.reward,
              desc: `隐藏任务：${generatedRoute.hiddenTask.name}`,
              date: "本周",
              amount: "领",
              icon: <Star size={18} />,
              color: "from-[#B45309] to-[#7C2D12]",
              tag: "隐藏",
              image: getCategoryImage(generatedRoute.hiddenTask.category),
              filterTag: filterTag(generatedRoute.hiddenTask.reward, generatedRoute.hiddenTask.name),
            }]
          : []),
      ]
    : [];

  const allCoupons = [...earnedCoupons, ...demoCoupons];
  const filteredCoupons = couponFilter === "全部"
    ? allCoupons
    : allCoupons.filter((c) => c.filterTag === couponFilter);

  const totalDays = tripHistory.length || 1;
  const totalRewards = allCoupons.length;
  const totalStops = tripHistory.reduce((s, t) => s + t.waypoints.filter((w) => w.visited).length, 0) || 3;

  const items = [
    { title: "能量棒", desc: "恢复 20 能量", count: 3, icon: "🧀", rarity: "普通" },
    { title: "追踪器", desc: "显示隐藏任务", count: 1, icon: "🧭", rarity: "稀有" },
  ];

  const gearMap: Record<string, { label: string; icon: any; desc: string }> = {
    phone: { label: "手机", icon: Smartphone, desc: "已充电 100%" },
    battery: { label: "充电宝", icon: Battery, desc: "20000mAh" },
    umbrella: { label: "雨伞", icon: Umbrella, desc: "折叠便携" },
    id_card: { label: "身份证", icon: CreditCard, desc: "有效证件" },
  };

  return (
    <AppLayout>
      <PageTitle
        title="背包"
        right={
          <button className="rounded-full border px-3 py-1.5 text-[11px] font-medium" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
            兑换记录
          </button>
        }
      />

      <main className="absolute inset-x-0 top-[100px] bottom-[104px] overflow-y-auto no-scrollbar px-4 pb-6">
        {/* 探索收获 */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[15px] font-black text-[var(--text-primary)]">探索收获</h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">每一次出发，都会遇见惊喜</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Trophy size={20} className="text-amber-500" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatChip icon="📅" value={`${totalDays}天`} />
            <StatChip icon="📍" value={`${totalStops}站`} />
            <StatChip icon="🎁" value={`${totalRewards}券`} />
            <StatChip icon="⭐" value="Lv.1" />
          </div>
          <div className="flex items-center gap-2 mt-3">
            {[
              { label: "每站奖励", done: true },
              { label: "隐藏奖励", done: earnedCoupons.some((c) => c.tag === "隐藏") },
              { label: "首单奖励", done: false },
              { label: "连续探索", done: totalDays >= 3 },
            ].map((b) => (
              <div
                key={b.label}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
                  b.done
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-[var(--bg-input)] text-[var(--text-faint)]"
                }`}
              >
                {b.done ? "✓" : "○"} {b.label}
              </div>
            ))}
          </div>
        </div>

        <TabBar tabs={["优惠券", "道具", "装备"]} active={activeTab} onChange={setActiveTab} />

        <AnimatePresence mode="wait">
          {activeTab === 0 && (
            <motion.div
              key="coupons"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* 品类筛选 */}
              <div className="mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {COUPON_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setCouponFilter(f)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                      couponFilter === f
                        ? "bg-[#6C5CFF] text-white"
                        : ""
                    }`}
                    style={couponFilter !== f ? { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" } : undefined}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* 优惠券列表 */}
              <div className="mt-4 space-y-3">
                {filteredCoupons.map((c, idx) => (
                  <CouponCard key={`${c.title}-${idx}`} {...c} index={idx} />
                ))}
                {/* 神秘券位 */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: filteredCoupons.length * 0.05 }}
                  className="flex h-[90px] items-center justify-center rounded-2xl border-2 border-dashed"
                  style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)" }}
                >
                  <div className="text-center">
                    <p className="text-[16px] font-black tracking-[0.3em]" style={{ color: "var(--text-faint)" }}>? ? ? ? ?</p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>继续探索解锁更多奖励</p>
                  </div>
                </motion.div>
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
                        className="flex items-center gap-4 rounded-2xl border p-4"
                        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-card)" }}
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6C5CFF]/15 text-[#6C5CFF]">
                          <item.icon size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="text-[15px] font-black" style={{ color: "var(--text-primary)" }}>{item.label}</div>
                          <div className="text-[11px] text-[var(--text-muted)]">{item.desc}</div>
                        </div>
                        <div className="rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-bold text-green-600 dark:text-green-400">已就绪</div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-20 flex flex-col items-center justify-center text-center px-10" style={{ color: "var(--text-muted)" }}>
                  <div className="h-20 w-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "var(--bg-input)" }}>
                    <Battery size={32} />
                  </div>
                  <h3 className="text-[16px] font-bold" style={{ color: "var(--text-secondary)" }}>暂无装备</h3>
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

function StatChip({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-input)] px-2.5 py-1.5">
      <span className="text-[13px]">{icon}</span>
      <span className="text-[12px] font-bold text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

function FakeQR({ seed }: { seed: number }) {
  const S = 21;
  const M = 10;
  const grid: boolean[][] = Array.from({ length: S }, () => Array(S).fill(false));

  const drawFinder = (r: number, c: number) => {
    for (let dr = 0; dr < 7; dr++)
      for (let dc = 0; dc < 7; dc++) {
        const border = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        grid[r + dr][c + dc] = border || inner;
      }
  };
  drawFinder(0, 0);
  drawFinder(0, S - 7);
  drawFinder(S - 7, 0);

  for (let i = 0; i < S; i++) {
    if (!grid[6][i]) grid[6][i] = i % 2 === 0;
    if (!grid[i][6]) grid[i][6] = i % 2 === 0;
  }

  for (let dr = 0; dr < 5; dr++)
    for (let dc = 0; dc < 5; dc++) {
      const border = dr === 0 || dr === 4 || dc === 0 || dc === 4;
      const center = dr === 2 && dc === 2;
      grid[S - 9 + dr][S - 9 + dc] = border || center;
    }

  let h = seed;
  for (let r = 0; r < S; r++)
    for (let c = 0; c < S; c++) {
      if (grid[r][c]) continue;
      if (r <= 8 && c <= 8) continue;
      if (r <= 8 && c >= S - 8) continue;
      if (r >= S - 8 && c <= 8) continue;
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      grid[r][c] = h % 3 !== 0;
    }

  return (
    <>
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? <rect key={`${r}-${c}`} x={c * M} y={r * M} width={M} height={M} fill="#000" /> : null
        )
      )}
    </>
  );
}

interface CouponCardProps extends Coupon {
  index: number;
  filterTag?: string;
  key?: string | number;
}

function CouponCard({ title, desc, date, amount, icon, color, tag, image, index }: CouponCardProps) {
  const [showQR, setShowQR] = useState(false);
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowQR(true)}
        className="flex items-stretch overflow-hidden rounded-2xl border shadow-sm cursor-pointer"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-card)" }}
      >
        {/* 左侧图片 */}
        <div className="w-[90px] shrink-0">
          <CouponImage src={image} className="h-full w-full" />
        </div>

        {/* 中间内容 */}
        <div className="flex flex-1 flex-col justify-center px-3 py-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-black text-[var(--text-primary)] leading-tight truncate">{title}</span>
            {tag && (
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-600 dark:text-amber-400">
                {tag}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)] truncate">{desc}</p>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
            <Clock size={10} />
            <span>{date} 到期</span>
          </div>
        </div>

        {/* 右侧金额 + 按钮 */}
        <div className="flex w-[72px] shrink-0 flex-col items-center justify-center border-l border-dashed border-[var(--border-subtle)] px-2">
          <span className="text-[20px] font-black text-[#6C5CFF]">{amount}</span>
          <span className="mt-1 rounded-full bg-[#6C5CFF] px-2.5 py-1 text-[9px] font-bold text-white">
            {amount === "领" ? "领取" : "使用"}
          </span>
        </div>
      </motion.div>

      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[280px] rounded-3xl p-6 text-center border shadow-2xl"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 active:scale-90" style={{ color: "var(--text-faint)" }}>
                <X size={20} />
              </button>
              <div className="mb-4">
                <div className="text-[16px] font-black" style={{ color: "var(--text-primary)" }}>{title}</div>
                <div className="text-[12px] text-[var(--text-muted)] mt-1">{desc}</div>
              </div>
              <div className="mx-auto w-[180px] h-[180px] bg-white rounded-2xl p-2 flex items-center justify-center">
                <svg viewBox="0 0 210 210" className="w-full h-full">
                  <FakeQR seed={title.length * 7 + desc.length * 13} />
                </svg>
              </div>
              <div className="mt-4 text-[11px]" style={{ color: "var(--text-faint)" }}>向商家出示此二维码即可使用</div>
              <div className="mt-1 text-[10px] font-mono opacity-50" style={{ color: "var(--text-faint)" }}>COUPON-{Date.now().toString(36).toUpperCase().slice(-6)}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
      className={`flex flex-col rounded-2xl border ${isRare ? 'border-amber-500/30 bg-amber-500/5' : ''} p-3.5 relative overflow-hidden group transition-all cursor-pointer`}
      style={isRare ? undefined : { borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-card)" }}
    >
      <div className="absolute -top-6 -right-6 h-12 w-12 rounded-full blur-xl group-hover:bg-[#6C5CFF]/20 transition-colors" style={{ backgroundColor: "var(--bg-input)" }} />

      <div className={`text-[9px] font-black uppercase tracking-tighter self-start px-2 py-0.5 rounded-full mb-3 ${
        isRare ? 'bg-amber-500 text-black' : ''
      }`}
      style={isRare ? undefined : { backgroundColor: "var(--bg-input)", color: "var(--text-faint)" }}>
        {rarity}
      </div>

      <div className="text-4xl my-2 flex justify-center drop-shadow-lg group-hover:scale-110 transition-transform">{icon}</div>

      <div className="mt-1">
        <div className="text-[15px] font-black text-[var(--text-primary)] truncate">{title}</div>
        <p className="mt-0.5 text-[10px] text-[var(--text-muted)] leading-tight line-clamp-2 h-6">{desc}</p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-tight" style={{ color: "var(--text-faint)" }}>存量 {count}</span>
        <div className={`h-6 w-6 rounded-lg flex items-center justify-center transition-colors ${
          isRare ? 'bg-amber-500/20 text-amber-500' : ''
        }`}
        style={isRare ? undefined : { backgroundColor: "var(--bg-input)", color: "var(--text-faint)" }}>
          <ChevronRight size={14} />
        </div>
      </div>
    </motion.div>
  );
}
