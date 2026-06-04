import React, { useState } from "react";
import { Bell, Settings, HelpCircle, Star, ChevronRight, Share2, Mail, MapPin, Sparkles, Gift, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";
import { BottomNav, PageTitle } from "../components/CommonUI";
import { ScreenType, UserProfile, GeneratedRoute, TripRecord } from "../types";
import { projectLatLng, NETWORK_BBOX, ORIGIN, type BBox } from "../components/mapProjection";
import streetNetwork from "../../scripts/data/street-network.json";
import terrainRaw from "../../scripts/data/terrain.json";

interface _Street { name: string; highway: string; points: { lat: number; lng: number }[] }
const streets = (streetNetwork as { streets: _Street[] }).streets;
const terrainPolygons = (terrainRaw as { polygons: { name: string; type: string; points: { lat: number; lng: number }[] }[] }).polygons;

const TERRAIN_FILL_DARK: Record<string, string> = {
  campus: "#1F1B47", park: "#0F3A24", water: "#0E3B47", commercial: "#3D3013",
};
const TERRAIN_FILL_LIGHT: Record<string, string> = {
  campus: "#E8E4F8", park: "#D6EFE0", water: "#D4EEF4", commercial: "#F5EDDA",
};

interface SysMessage { icon: React.ReactNode; title: string; desc: string; time: string }

const AVATAR_OPTIONS = ["🧑🏻", "👩🏻", "👨🏻", "🧒🏻", "👧🏻", "🐱", "🐶", "🦊", "🐼", "🐨", "🦁", "🐯", "🐸", "🐙", "👻", "🤖"];

export function MineScreen({ onNavigate, profile, generatedRoute, tripHistory = [], onUpdateProfile }: { onNavigate: (s: ScreenType) => void; profile?: UserProfile | null; generatedRoute?: GeneratedRoute | null; tripHistory?: TripRecord[]; onUpdateProfile?: (p: UserProfile) => void }) {
  const [panel, setPanel] = useState<null | "notif" | "sys" | "avatar">(null);
  const [notifRead, setNotifRead] = useState(false);
  const [sysRead, setSysRead] = useState(false);

  // 铃铛 = 动态通知：本次探索的活动事件（路线/隐藏坐标/奖励/MBTI 定制）
  const notifications: SysMessage[] = [];
  if (generatedRoute) {
    notifications.push({ icon: <MapPin size={18} />, title: "今日路线已就绪", desc: `${generatedRoute.title}（共 ${generatedRoute.waypoints.length} 站）`, time: "刚刚" });
    if (generatedRoute.hiddenTask) {
      notifications.push({ icon: <Sparkles size={18} />, title: "发现隐藏坐标", desc: `「${generatedRoute.hiddenTask.name}」就在附近，去解锁`, time: "刚刚" });
    }
    const firstReward = generatedRoute.waypoints[0]?.reward;
    if (firstReward) {
      notifications.push({ icon: <Gift size={18} />, title: "打卡奖励待领取", desc: `完成首站可得「${firstReward}」`, time: "今天" });
    }
  }
  if (profile?.mbti) {
    notifications.push({ icon: <Star size={18} />, title: "已为你定制", desc: `按你的 ${profile.mbti} 偏好优化了今日选址`, time: "今天" });
  }

  // 系统消息 = 官方/常驻公告
  const systemMessages: SysMessage[] = [
    { icon: <Gift size={18} />, title: "优惠券提醒", desc: "你有未使用的优惠券，记得在到期前用掉", time: "1天前" },
    { icon: <MapPin size={18} />, title: "探索小贴士", desc: "点地图任意位置就能走过去，靠近目标即可打卡", time: "2天前" },
    { icon: <Bell size={18} />, title: "欢迎回到「那我走」", desc: "说走就走，剩下交给系统", time: "3天前" },
  ];

  return (
    <AppLayout>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_16%,rgba(255,209,102,.12),transparent_20%)]" />
      <PageTitle 
        title="我的" 
        right={
          <div className="flex gap-4">
            <button className="relative" onClick={() => { setPanel("notif"); setNotifRead(true); }}>
              <Bell size={20} />
              {notifications.length > 0 && !notifRead && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-[#FF4D64] rounded-full border" style={{ borderColor: "var(--bg-base)" }} />
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
          <button onClick={() => setPanel("avatar")} className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#6C5CFF]/60 bg-gradient-to-br from-[#FFD7BD] to-[#7B4B3A] text-4xl shadow-lg ring-4 ring-[#6C5CFF]/10 active:scale-95 transition-transform">
            {profile?.avatar ?? "🧑🏻"}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#6C5CFF] text-[10px] text-white shadow">✎</span>
          </button>
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
               <div className="h-1.5 w-[100px] rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                 <motion.div initial={{ width: 0 }} animate={{ width: "62%" }} className="h-full rounded-full bg-[#6C5CFF]" />
               </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <FootprintMap tripHistory={tripHistory} />
        </div>
        
        <Glass className="mt-5 p-4 grid grid-cols-4 gap-2">
          <StatCard num={String(tripHistory.length || 28)} label="天数" />
          <StatCard num={String(tripHistory.length > 0 ? Math.round(tripHistory.reduce((s, t) => s + t.distanceKm, 0) * 10) / 10 : 86.3)} label="公里" />
          <StatCard num={String(tripHistory.length > 0 ? tripHistory.reduce((s, t) => s + t.waypoints.filter((w) => w.visited).length, 0) : 56)} label="任务" />
          <StatCard num={String(tripHistory.length > 0 ? tripHistory.reduce((s, t) => s + t.rewards.length, 0) : 26)} label="礼券" />
        </Glass>
        
        <div className="mt-6 space-y-3">
          <MenuRow icon={<Mail size={20} />} label="系统消息" count={sysRead ? undefined : systemMessages.length} onClick={() => { setPanel("sys"); setSysRead(true); }} />
          <MenuRow icon={<Share2 size={20} />} label="邀请好友" />
          <MenuRow icon={<HelpCircle size={20} />} label="帮助反馈" />
        </div>
      </main>
      <BottomNav active="mine" onNavigate={onNavigate} />

      <AnimatePresence>
        {(panel === "notif" || panel === "sys") && (
          <NotificationsOverlay
            title={panel === "notif" ? "通知" : "系统消息"}
            messages={panel === "notif" ? notifications : systemMessages}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === "avatar" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPanel(null)}
            className="absolute inset-0 z-[120] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 240 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-t-[28px] border-t p-5 pb-8"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[18px] font-black" style={{ color: "var(--text-primary)" }}>选择头像</h2>
                <button onClick={() => setPanel(null)} className="rounded-full p-1.5 active:scale-90" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-8 gap-2">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      if (!profile) return;
                      const updated = { ...profile, avatar: emoji };
                      try { localStorage.setItem("userProfile", JSON.stringify(updated)); } catch {}
                      onUpdateProfile?.(updated);
                      setPanel(null);
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl active:scale-90 transition-transform ${
                      (profile?.avatar ?? "🧑🏻") === emoji ? "bg-[#6C5CFF]/20 ring-2 ring-[#6C5CFF]" : ""
                    }`}
                    style={(profile?.avatar ?? "🧑🏻") !== emoji ? { backgroundColor: "var(--bg-input)" } : undefined}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

function NotificationsOverlay({ title, messages, onClose }: { title: string; messages: SysMessage[]; onClose: () => void }) {
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
        className="max-h-[70%] overflow-y-auto no-scrollbar rounded-t-[28px] border-t p-5 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-[#A98BFF]" />
            <h2 className="text-[17px] font-bold" style={{ color: "var(--text-primary)" }}>{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 active:scale-90" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2.5">
          {messages.length === 0 && (
            <div className="py-10 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>暂无消息</div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border p-3.5" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)" }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6C5CFF]/15 text-[#A98BFF]">
                {m.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold truncate" style={{ color: "var(--text-primary)" }}>{m.title}</span>
                  <span className="shrink-0 text-[10px]" style={{ color: "var(--text-faint)" }}>{m.time}</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FootprintMapContent({ mapW, mapH, uniquePoints, toPixel, showFog }: {
  mapW: number; mapH: number;
  uniquePoints: { name: string; emoji: string; lat: number; lng: number }[];
  toPixel: (lat: number, lng: number) => { x: number; y: number };
  showFog?: boolean;
}) {
  const home = toPixel(ORIGIN.lat, ORIGIN.lng);
  const FOG_RADIUS = Math.min(mapW, mapH) * 0.08;
  const fogId = `fog-${mapW}x${mapH}`;

  const clearSpots = [
    home,
    ...uniquePoints.map((w) => toPixel(w.lat, w.lng)),
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border shadow-inner" style={{ height: mapH, backgroundColor: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
      {/* 路网 + 地表底图 */}
      <svg className="absolute inset-0 z-[1]" width={mapW} height={mapH}>
        <g opacity={0.35}>
          {terrainPolygons.map((poly, i) => {
            const pts = poly.points.map((p) => { const px = toPixel(p.lat, p.lng); return `${px.x},${px.y}`; }).join(" ");
            const isLight = typeof document !== "undefined" && document.querySelector("[data-theme=light]");
            const fill = isLight ? (TERRAIN_FILL_LIGHT[poly.type] ?? "#E8E8F0") : (TERRAIN_FILL_DARK[poly.type] ?? "#1A1A2E");
            return <polygon key={i} points={pts} fill={fill} opacity={0.5} />;
          })}
        </g>
        <g opacity={0.4}>
          {streets.map((s, i) => {
            const d = s.points.map((p, j) => { const px = toPixel(p.lat, p.lng); return `${j === 0 ? "M" : "L"}${px.x} ${px.y}`; }).join(" ");
            const w = s.highway === "primary" ? 1.5 : s.highway === "secondary" ? 1 : 0.6;
            return <path key={i} d={d} fill="none" stroke="rgba(169,139,255,0.5)" strokeWidth={w} strokeLinecap="round" />;
          })}
        </g>
      </svg>

      <div className="absolute z-10" style={{ left: home.x - 14, top: home.y - 14, width: 28, height: 28 }}>
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-[#6C5CFF]/40 blur-sm"
        />
        <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[#6C5CFF] ring-3 ring-[#6C5CFF]/30 shadow-[0_0_12px_#6C5CFF] text-[13px]">🏠</div>
      </div>

      {uniquePoints.map((w, i) => {
        const pos = toPixel(w.lat, w.lng);
        return (
          <motion.div
            key={`${w.name}-${i}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + i * 0.05 }}
            className="absolute flex items-center justify-center"
            style={{ left: pos.x - 12, top: pos.y - 12, width: 24, height: 24 }}
          >
            <span className="text-[16px] drop-shadow-[0_0_4px_rgba(255,209,102,0.8)]">{w.emoji}</span>
          </motion.div>
        );
      })}

      {uniquePoints.length === 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>完成探索后足迹会出现在这里</p>
        </div>
      )}

      {/* 迷雾层：整体覆盖迷雾，去过的位置挖透明洞 */}
      {showFog && (
        <svg className="absolute inset-0 z-[15] pointer-events-none" width={mapW} height={mapH}>
          <defs>
            <radialGradient id={`${fogId}-hole`}>
              <stop offset="0%" stopColor="black" stopOpacity="1" />
              <stop offset="60%" stopColor="black" stopOpacity="0.8" />
              <stop offset="100%" stopColor="black" stopOpacity="0" />
            </radialGradient>
            <mask id={fogId}>
              {/* 白底 = 全部显示迷雾 */}
              <rect width={mapW} height={mapH} fill="white" />
              {/* 黑色圆 = 挖洞，去过的地方不显示迷雾 */}
              {clearSpots.map((pos, i) => (
                <circle key={i} cx={pos.x} cy={pos.y} r={FOG_RADIUS} fill={`url(#${fogId}-hole)`} />
              ))}
            </mask>
          </defs>
          <rect
            width={mapW}
            height={mapH}
            fill="var(--fog-color, rgba(5,6,15,0.92))"
            mask={`url(#${fogId})`}
          />
        </svg>
      )}
    </div>
  );
}

function FootprintMap({ tripHistory }: { tripHistory: TripRecord[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const allWaypoints = tripHistory.flatMap((t) => t.waypoints.filter((w) => w.visited));
  const uniquePoints = allWaypoints.reduce<{ name: string; emoji: string; lat: number; lng: number }[]>((acc, w) => {
    if (!acc.some((p) => p.name === w.name)) acc.push(w);
    return acc;
  }, []);

  const bbox = NETWORK_BBOX;
  const fullW = projectLatLng({ lat: bbox.south, lng: bbox.east }, bbox).x;
  const fullH = projectLatLng({ lat: bbox.south, lng: bbox.east }, bbox).y;

  const makeProjection = (mapW: number, mapH: number) => {
    const sx = mapW / fullW;
    const sy = mapH / fullH;
    const s = Math.min(sx, sy) * 0.85;
    const ox = (mapW - fullW * s) / 2;
    const oy = (mapH - fullH * s) / 2;
    return (lat: number, lng: number) => {
      const p = projectLatLng({ lat, lng }, bbox);
      return { x: p.x * s + ox, y: p.y * s + oy };
    };
  };

  const MINI_W = 340;
  const MINI_H = 210;
  const unlockPct = Math.min(99, Math.round((uniquePoints.length / 105) * 100));

  return (
    <>
      <Glass className="relative overflow-hidden p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[19px] font-bold" style={{ color: "var(--text-primary)" }}>我的足迹地图</div>
          <div className="text-[13px] font-medium px-2 py-0.5 rounded bg-[#6C5CFF]/20 text-[#A98BFF]">已解锁 {unlockPct}% 地点</div>
        </div>
        <div className="relative">
          <FootprintMapContent mapW={MINI_W} mapH={MINI_H} uniquePoints={uniquePoints} toPixel={makeProjection(MINI_W, MINI_H)} />
          <button
            onClick={() => setExpanded(true)}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full backdrop-blur-md px-4 py-2 text-[12px] font-bold border active:scale-95 transition-transform shadow-lg"
            style={{ color: "var(--text-secondary)", borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-card)" }}
          >
            查看全貌 <ChevronRight size={14} />
          </button>
        </div>
      </Glass>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpanded(false)}
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md p-5"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[460px] rounded-3xl border p-5 shadow-2xl"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-[17px] font-bold" style={{ color: "var(--text-primary)" }}>足迹全貌</div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-bold text-[#A98BFF]">{uniquePoints.length} 个地点</span>
                  <button onClick={() => setExpanded(false)} className="rounded-full p-1.5 active:scale-90" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <FootprintMapContent mapW={420} mapH={380} uniquePoints={uniquePoints} toPixel={makeProjection(420, 380)} showFog />
              {uniquePoints.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {uniquePoints.slice(0, 12).map((w, i) => (
                    <span key={i} className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                      {w.emoji} {w.name}
                    </span>
                  ))}
                  {uniquePoints.length > 12 && (
                    <span className="text-[11px] font-bold self-center" style={{ color: "var(--text-faint)" }}>+{uniquePoints.length - 12}</span>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StatCard({ num, label }: { num: string; label: string }) {
  return (
    <div className="rounded-xl p-2 text-center border" style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-subtle)" }}>
      <div className="text-[17px] font-black font-mono leading-none" style={{ color: "var(--text-primary)" }}>{num}</div>
      <div className="mt-1 text-[9px] uppercase tracking-tighter scale-90 font-bold" style={{ color: "var(--text-faint)" }}>{label}</div>
    </div>
  );
}

function Badge({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2 group cursor-pointer w-14">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${color} shadow-lg border group-hover:scale-110 transition-transform`} style={{ borderColor: "var(--border-subtle)" }}>
        <div className="filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">{icon}</div>
      </div>
      <span className="text-[10px] text-center leading-tight h-8 px-1" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

function MenuRow({ icon, label, count, onClick }: { icon: React.ReactNode; label: string; count?: number; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center justify-between p-4 rounded-2xl transition-colors cursor-pointer group" style={{ backgroundColor: "var(--bg-input)" }}>
      <div className="flex items-center gap-4">
        <div className="group-hover:text-[#A98BFF] transition-colors" style={{ color: "var(--text-muted)" }}>{icon}</div>
        <span className="text-[17px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {count && (
          <span className="bg-[#FF4D64] px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-[0_0_12px_rgba(255,77,100,0.4)]">
            {count}
          </span>
        )}
        <ChevronRight size={18} className="transition-colors" style={{ color: "var(--text-faint)" }} />
      </div>
    </div>
  );
}
