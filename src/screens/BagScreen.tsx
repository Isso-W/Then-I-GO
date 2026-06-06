import React, { useState, useEffect } from "react";
import qrcode from "qrcode-generator";
import { Gift, Star, Clock, Smartphone, Battery, Umbrella, CreditCard, X, ChevronRight, ChevronDown } from "lucide-react";
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
  const [badgeOpen, setBadgeOpen] = useState(false);
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
      title: "¥15饮品抵扣券", desc: "未名咖啡", date: "06.15", amount: "¥15",
      icon: <Gift size={18} />, color: "from-[#7C3AED] to-[#3B0F73]",
      image: "/categories/coffee.jpg", filterTag: "美食",
    },
    {
      title: "¥25烧烤代金券", desc: "串串香", date: "06.12", amount: "¥25",
      icon: <Gift size={18} />, color: "from-[#7C3AED] to-[#3B0F73]",
      image: "/categories/bbq.jpg", filterTag: "美食",
    },
    {
      title: "¥20餐饮代金券", desc: "京味儿炸酱面", date: "06.10", amount: "¥20",
      icon: <Gift size={18} />, color: "from-[#7C3AED] to-[#3B0F73]",
      image: "/categories/local-cuisine.jpg", filterTag: "美食",
    },
    {
      title: "¥30演出折扣券", desc: "五道口 Livehouse", date: "06.08", amount: "¥30",
      icon: <Gift size={18} />, color: "from-[#7C3AED] to-[#3B0F73]",
      image: "/categories/bar.jpg", filterTag: "娱乐",
    },
  ];

  const extractPrice = (reward: string): string => {
    const m = reward.match(/¥(\d+)/);
    return m ? `¥${m[1]}` : "¥0";
  };

  const earnedCoupons: (Coupon & { filterTag: string })[] = generatedRoute
    ? [
        ...generatedRoute.waypoints.map((wp) => ({
          title: wp.reward,
          desc: wp.name,
          date: "本周",
          amount: extractPrice(wp.reward),
          icon: <Gift size={18} />,
          color: "from-[#7C3AED] to-[#3B0F73]",
          tag: "今日",
          image: getCategoryImage(wp.category),
          filterTag: filterTag(wp.reward, wp.name),
        })),
        ...(generatedRoute.hiddenTask
          ? [{
              title: generatedRoute.hiddenTask.reward,
              desc: generatedRoute.hiddenTask.name,
              date: "本周",
              amount: extractPrice(generatedRoute.hiddenTask.reward),
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
  const hasHidden = earnedCoupons.some((c) => c.tag === "隐藏") || tripHistory.some(t => t.waypoints.some(w => w.isHidden && w.visited));
  const totalStops = tripHistory.reduce((s, t) => s + t.waypoints.filter((w) => w.visited).length, 0) || 3;

  // 连续天数：按日期去重排序，从最近一天往回数连续天数
  const consecutiveDays = React.useMemo(() => {
    const dateSet = new Set<string>();
    tripHistory.forEach(t => dateSet.add(t.date));
    const dates: string[] = [];
    dateSet.forEach(d => dates.push(d));
    dates.sort().reverse();
    if (dates.length === 0) return 0;
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const cur = new Date(dates[i]);
      const diff = (prev.getTime() - cur.getTime()) / (1000 * 60 * 60 * 24);
      if (Math.round(diff) === 1) streak++;
      else break;
    }
    return streak;
  }, [tripHistory]);

  const uniqueCategories = React.useMemo(() => {
    const emojis = new Set<string>();
    tripHistory.forEach(t => t.waypoints.filter(w => w.visited).forEach(w => emojis.add(w.emoji)));
    if (generatedRoute) generatedRoute.waypoints.forEach(wp => emojis.add(wp.emoji));
    return emojis.size;
  }, [tripHistory, generatedRoute]);

  const badges = [
    { icon: "🔥", label: "首次探索", desc: "完成第一次探索", done: totalDays >= 1, progress: `${Math.min(totalDays, 1)}/1` },
    { icon: "⚡", label: "连续3天", desc: "连续探索 3 天", done: consecutiveDays >= 3, progress: `${Math.min(consecutiveDays, 3)}/3` },
    { icon: "👑", label: "连续7天", desc: "连续探索 7 天", done: consecutiveDays >= 7, progress: `${Math.min(consecutiveDays, 7)}/7` },
    { icon: "🗺️", label: "打卡10站", desc: "累计打卡 10 个站点", done: totalStops >= 10, progress: `${Math.min(totalStops, 10)}/10` },
    { icon: "🔮", label: "隐藏任务", desc: "完成一次隐藏任务", done: hasHidden, progress: hasHidden ? "1/1" : "0/1" },
    { icon: "🎯", label: "集齐5券", desc: "累计获得 5 张优惠券", done: allCoupons.length >= 5, progress: `${Math.min(allCoupons.length, 5)}/5` },
    { icon: "🌟", label: "探索达人", desc: "累计探索 14 次", done: totalDays >= 14, progress: `${Math.min(totalDays, 14)}/14` },
    { icon: "💎", label: "全品类通关", desc: "探索 8 种不同品类", done: uniqueCategories >= 8, progress: `${Math.min(uniqueCategories, 8)}/8` },
  ];

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
        {/* 成就徽章（可折叠） */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] mb-4 overflow-hidden">
          <button
            onClick={() => setBadgeOpen(!badgeOpen)}
            className="flex w-full items-center justify-between p-4 active:bg-[var(--bg-input)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-black text-[var(--text-primary)]">成就徽章</h3>
              <span className="rounded-full bg-[#6C5CFF]/15 px-2 py-0.5 text-[11px] font-black text-[#A98BFF]">{badges.filter(b => b.done).length}/{badges.length}</span>
            </div>
            <motion.div animate={{ rotate: badgeOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={18} style={{ color: "var(--text-muted)" }} />
            </motion.div>
          </button>
          <AnimatePresence>
            {badgeOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-2">
                  {badges.map((b) => (
                    <div key={b.label} className={`flex items-center gap-3 rounded-xl p-2.5 ${b.done ? "bg-amber-500/10" : "bg-[var(--bg-input)]"}`}>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px] ${
                        b.done ? "bg-amber-500/15 shadow-[0_0_8px_rgba(245,158,11,0.15)]" : "grayscale opacity-40"
                      }`}>
                        {b.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-bold ${b.done ? "text-[var(--text-primary)]" : "text-[var(--text-faint)]"}`}>{b.label}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{b.desc}</div>
                      </div>
                      <span className={`text-[11px] font-bold shrink-0 ${b.done ? "text-amber-500" : "text-[var(--text-faint)]"}`}>{b.progress}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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


const LUCKY_MESSAGES = [
  "扫到的人今年暴富！💰",
  "恭喜你发现了彩蛋🥚 今天出门捡钱",
  "评委老师辛苦了！给您磕一个 🙇",
  "这张券价值一个亿，信不信由你",
  "你已被「那我走」系统标记为：天选之人 ✨",
  "本券可兑换：一段美好回忆（不可退换）",
  "扫码成功！你的魅力值 +999",
  "恭喜触发隐藏成就：二维码鉴赏家 🏆",
  "据说扫到这个码的人，下次出门必遇好事",
  "你好呀！我是一张有梦想的优惠券 🎫",
  "系统提示：检测到一位宝藏评委 💎",
  "这不是bug，这是feature（确信）",
];

function pickMessage(seed: number): string {
  return LUCKY_MESSAGES[Math.abs(seed) % LUCKY_MESSAGES.length];
}

function toUTF8Bytes(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
}

function RealQR({ text }: { text: string }) {
  const cells = React.useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(toUTF8Bytes(text), "Byte");
    qr.make();
    const count = qr.getModuleCount();
    const result: { r: number; c: number }[] = [];
    for (let r = 0; r < count; r++)
      for (let c = 0; c < count; c++)
        if (qr.isDark(r, c)) result.push({ r, c });
    return { count, dark: result };
  }, [text]);

  const M = 10;
  const size = cells.count * M;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
      {cells.dark.map(({ r, c }) => (
        <rect key={`${r}-${c}`} x={c * M} y={r * M} width={M} height={M} rx={1} fill="#000" />
      ))}
    </svg>
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
            <span className="text-[14px] font-black text-[var(--text-primary)] leading-tight truncate">{title.replace(/^¥\d+/, "")}</span>
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
            使用
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
              <div className="mx-auto w-[180px] h-[180px] bg-white rounded-2xl p-3 flex items-center justify-center">
                <RealQR text={pickMessage(title.length * 7 + desc.length * 13)} />
              </div>
              <div className="mt-4 text-[11px]" style={{ color: "var(--text-faint)" }}>扫一扫，也许有惊喜</div>
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
