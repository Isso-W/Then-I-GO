import React from "react";
import { MapPin, Gift, Coffee, Star, PlayCircle, ChevronDown, ChevronRight, Sparkles, X, Loader2, Wand2, Film, Music, CheckCircle2, Play, Share2, RotateCcw, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";
import { BottomNav, PageTitle, TabBar } from "../components/CommonUI";
import { ScreenType, TimelineItemData, GeneratedRoute, GeneratedVlog, VlogStyle, TripRecord } from "../types";
import { generateVlog, VlogStop } from "../agents/vlogAgent";
import { computeVlogGeo } from "../lib/routeGeometry";
import { RouteReplay } from "../components/RouteReplay";
import { LivePhoto } from "../components/LivePhoto";
import { MapPinned, Footprints, Ticket, ImagePlus } from "lucide-react";

// 三种风格的展示信息（标签 + 预览渐变 + 播放器滤镜/主题）
const STYLE_META: Record<VlogStyle, {
  label: string; desc: string; preview: string; accent: string; filter: string; overlay: string;
}> = {
  cyberpunk: {
    label: "赛博朋克", desc: "霓虹夜色 · 未来都市",
    preview: "bg-gradient-to-br from-fuchsia-600 via-purple-800 to-cyan-500",
    accent: "#00E5FF",
    filter: "saturate-[1.5] contrast-[1.2]",
    overlay: "bg-gradient-to-t from-fuchsia-900/60 via-transparent to-cyan-700/30 mix-blend-screen",
  },
  retro: {
    label: "复古胶片", desc: "暖色颗粒 · City Pop",
    preview: "bg-gradient-to-br from-amber-700 via-orange-800 to-yellow-600",
    accent: "#FFD166",
    filter: "sepia-[.35] contrast-[1.1] brightness-95",
    overlay: "bg-gradient-to-t from-amber-950/70 via-orange-900/10 to-orange-800/20",
  },
  fresh: {
    label: "日系清新", desc: "柔光治愈 · Lo-fi",
    preview: "bg-gradient-to-br from-teal-400 via-sky-400 to-emerald-300",
    accent: "#7FE7C4",
    filter: "saturate-[1.1] brightness-110",
    overlay: "bg-gradient-to-t from-slate-900/50 via-transparent to-white/10",
  },
};

const STYLE_ORDER: VlogStyle[] = ["fresh", "retro", "cyberpunk"];

// 去掉标题前缀的 emoji / "秘密：" 等，给 agent 干净的站点名
function cleanName(title: string): string {
  return title.replace(/^[\p{Extended_Pictographic}️\s]+/u, "").replace(/^秘密：/, "").trim();
}

function fmtDuration(scenes: { durationSec: number }[]): string {
  const total = scenes.reduce((s, x) => s + x.durationSec, 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const REACTION_OPTIONS = ["🤩", "😎", "😐", "😩", "💀", "💸"];

export function StoryScreen({ onNavigate, generatedRoute, checkinPhotos = {}, vlogs = [], onVlogGenerated, tripHistory = [], onTripReaction, onWaypointReaction, onTripFeedback, mystery, waypointIndex = 0, hiddenTriggered }: {
  onNavigate: (s: ScreenType) => void;
  generatedRoute?: GeneratedRoute | null;
  checkinPhotos?: Record<number, string>;
  vlogs?: GeneratedVlog[];
  onVlogGenerated?: (v: GeneratedVlog) => void;
  tripHistory?: TripRecord[];
  onTripReaction?: (tripId: string, emoji: string) => void;
  onWaypointReaction?: (tripId: string, waypointIdx: number, emoji: string) => void;
  onTripFeedback?: (tripId: string, text: string) => void;
  mystery?: boolean;
  waypointIndex?: number;
  hiddenTriggered?: boolean;
}) {
  const [activeTab, setActiveTab] = React.useState(0);
  const [selectedDate, setSelectedDate] = React.useState("今日");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [genReady, setGenReady] = React.useState(false); // 真实生成完成（让进度条收尾）
  const [playingVlog, setPlayingVlog] = React.useState<GeneratedVlog | null>(null);
  const pendingVlog = React.useRef<GeneratedVlog | null>(null);
  // 用户为每一站上传的照片：站点 index → dataURL
  const [uploads, setUploads] = React.useState<Record<number, string>>({});
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadIdxRef = React.useRef<number>(-1);

  const dates = ["今日", "05.23", "05.22", "05.21", "05.20"];

  const itemsByDate: Record<string, TimelineItemData[]> = {
    "今日": [
      { time: "10:15", title: "出发", desc: "从“家”出发，期待的一天！", icon: <MapPin size={17} />, img: "bg-gradient-to-br from-green-700 to-yellow-300" },
      { time: "10:32", title: "便利店奇遇", desc: "发现了一份惊喜礼包~", icon: <Gift size={17} />, img: "bg-gradient-to-br from-yellow-700 to-slate-800", recorded: true },
      { time: "11:08", title: "路边的咖啡馆", desc: "一杯拿铁，享受片刻宁静。", icon: <Coffee size={17} />, img: "bg-gradient-to-br from-[#3B2417] to-[#EEE0C8]" },
      { time: "12:05", title: "城市公园", desc: "湖边风景真美，心情大好！", icon: <Star size={17} />, img: "bg-gradient-to-br from-green-900 to-sky-300" }
    ],
    "05.23": [
      { time: "14:20", title: "雨中漫步", desc: "北京的雨总是来得突然。", icon: <MapPin size={17} />, img: "bg-gradient-to-br from-blue-700 to-slate-600" },
      { time: "16:45", title: "小店避雨", desc: "在一个复古唱片店呆了一个下午。", icon: <Star size={17} />, img: "bg-gradient-to-br from-purple-700 to-indigo-900" }
    ]
  };

  // 今日素材集：有 AI 路线时用真实路线的站点（含隐藏任务），否则回退到示例
  const routeGradients = [
    "bg-gradient-to-br from-[#3B2417] to-[#EEE0C8]",
    "bg-gradient-to-br from-green-900 to-sky-300",
    "bg-gradient-to-br from-purple-700 to-indigo-900",
    "bg-gradient-to-br from-blue-700 to-slate-600",
  ];
  const routeItems: TimelineItemData[] | null = generatedRoute
    ? [
        ...generatedRoute.waypoints.map((wp, i) => {
          const hidden = mystery && i > waypointIndex;
          return {
            time: `第${i + 1}站`,
            title: hidden ? `${wp.emoji} ???` : `${wp.emoji} ${wp.name}`,
            desc: hidden ? "到达后揭晓" : wp.description,
            icon: <MapPin size={17} />,
            img: routeGradients[i % routeGradients.length],
          };
        }),
        ...(generatedRoute.hiddenTask && hiddenTriggered
          ? [{
              time: "隐藏",
              title: mystery ? `✨ 秘密：???` : `${generatedRoute.hiddenTask.emoji} 秘密：${generatedRoute.hiddenTask.name}`,
              desc: mystery ? "到达后揭晓" : generatedRoute.hiddenTask.description,
              icon: <Sparkles size={17} />,
              img: "bg-gradient-to-br from-amber-700 to-yellow-300",
            }]
          : []),
      ]
    : null;

  const currentItems =
    selectedDate === "今日"
      ? routeItems
      : itemsByDate[selectedDate] || null;

  const routeTitle =
    selectedDate === "今日"
      ? generatedRoute?.title ?? "今日漫游"
      : `${selectedDate} 漫游`;

  // Vlog 是"今天这趟走法"的记录：必须先有真实路线（跑过探索）才能生成
  const canGenerate = !!generatedRoute && generatedRoute.waypoints.length > 0;

  // 生成 Vlog 用的规范站点列表（也是上传配图的对象）：
  // 有真实路线 → waypoints(+隐藏任务)，与回放地图站点一一对应；否则退回时间线素材。
  // 按实际探索顺序：wp[0] → wp[1] → ... → wp[N-1] → hiddenTask
  const genStops = React.useMemo(
    () => {
      if (!generatedRoute) return (currentItems ?? []).map((it) => ({ name: cleanName(it.title), desc: it.desc, emoji: "📍" }));
      const ordered: { name: string; desc: string; emoji: string }[] = generatedRoute.waypoints.map((wp, i) => {
        const hidden = mystery && i > waypointIndex;
        return { name: hidden ? "???" : wp.name, desc: hidden ? "到达后揭晓" : wp.description, emoji: wp.emoji };
      });
      if (generatedRoute.hiddenTask && hiddenTriggered) {
        const hiddenMasked = mystery;
        ordered.push({
          name: hiddenMasked ? "???" : generatedRoute.hiddenTask.name,
          desc: hiddenMasked ? "到达后揭晓" : generatedRoute.hiddenTask.description,
          emoji: generatedRoute.hiddenTask.emoji,
        });
      }
      return ordered;
    },
    [generatedRoute, currentItems, mystery, waypointIndex, hiddenTriggered]
  );

  // 切日期 / 换路线时重置配图：今日用打卡拍的照片预填，其他清空
  React.useEffect(() => {
    if (selectedDate === "今日" && Object.keys(checkinPhotos).length > 0) {
      setUploads({ ...checkinPhotos });
    } else {
      setUploads({});
    }
  }, [selectedDate, generatedRoute, checkinPhotos]);

  // 点某一站的上传槽 → 打开文件选择
  const pickPhoto = (idx: number) => {
    uploadIdxRef.current = idx;
    fileInputRef.current?.click();
  };
  // 读文件 → 缩放到 ≤720px 宽的 JPEG dataURL（省内存，和占位图同规格）
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = uploadIdxRef.current;
    e.target.value = ""; // 允许重复选同一文件
    if (!file || idx < 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 720;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setUploads((prev) => ({ ...prev, [idx]: dataUrl }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 用户选定风格 → 真实调 Vlog agent；进度条跟 Promise 走，完成后弹播放器
  const startGeneration = async (style: VlogStyle) => {
    setPickerOpen(false);
    setIsGenerating(true);
    setGenReady(false);
    pendingVlog.current = null;
    // 站点带上用户照片（没传的用占位 B-roll）
    const stops: VlogStop[] = genStops.map((s, i) => ({ ...s, photo: uploads[i] }));
    try {
      const vlog = await generateVlog({ routeTitle, stops, style });
      if (generatedRoute) vlog.geo = computeVlogGeo(generatedRoute);
      pendingVlog.current = vlog;
    } catch (e) {
      console.error("Vlog 生成异常：", e);
    } finally {
      setGenReady(true); // 让 VlogGenerationOverlay 收尾到 100%
    }
  };

  // 进度条跑到 100% 后：把成片存进历史并打开播放器
  const finishGeneration = () => {
    setIsGenerating(false);
    const vlog = pendingVlog.current;
    pendingVlog.current = null;
    if (vlog) {
      onVlogGenerated?.(vlog);
      setPlayingVlog(vlog);
    }
  };

  // 历史记录：本 session 真实生成的 Vlog（新→旧）叠在探索卡片之上
  const realHistory = vlogs.map((v) => ({
    vlog: v,
    date: new Date(v.createdAt).toLocaleDateString("zh-CN").replace(/\//g, "."),
    duration: fmtDuration(v.scenes),
    img: v.scenes[0]?.frame ?? "/vlog/coffee.jpg",
  }));

  return (
    <AppLayout>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_15%,rgba(108,92,255,.18),transparent_30%)]" />
      <PageTitle title="故事" />
      
      <main className="absolute inset-x-5 top-[100px] bottom-[104px] overflow-y-auto no-scrollbar pb-6">
        <TabBar tabs={["Vlog 素材", "历史记录"]} active={activeTab} onChange={setActiveTab} />

        <div className="mt-6">
          <AnimatePresence mode="wait">
            {activeTab === 0 ? (
              <motion.div
                key="vlog-materials"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="mb-4">
                  {/* Date Selector */}
                  <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-5 mb-1">
                    {dates.map((date) => (
                      <button
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] font-black transition-all border ${
                          selectedDate === date
                            ? "bg-[#6C5CFF] border-[#6C5CFF] text-white shadow-[0_5px_15px_rgba(108,92,255,0.3)]"
                            : ""
                        }`}
                        style={selectedDate !== date ? { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" } : undefined}
                      >
                        {date === "今日" ? "今日" : date}
                      </button>
                    ))}
                  </div>

                  {currentItems ? (
                  <>
                  <div className="flex items-center justify-between mb-4 text-[11px] uppercase tracking-widest font-black" style={{ color: "var(--text-faint)" }}>
                    <span className="flex items-center gap-1.5">
                      <div className="h-1 w-3 bg-[#6C5CFF] rounded-full" />
                      {selectedDate === "今日" ? "今日素材集" : `${selectedDate} 素材集`}
                    </span>
                    <span className="text-[#6C5CFF]">{currentItems.length} 个片段</span>
                  </div>

                  <div className="space-y-0">
                    {currentItems.map((it, idx) => (
                      <TimelineItem
                        key={`${selectedDate}-${it.time}`}
                        time={it.time}
                        title={it.title}
                        desc={it.desc}
                        icon={it.icon}
                        img={it.img}
                        recorded={it.recorded}
                        index={idx}
                      />
                    ))}
                  </div>

                  {canGenerate && (
                  <div className="mt-5">
                    <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-widest font-black" style={{ color: "var(--text-faint)" }}>
                      <span className="flex items-center gap-1.5">
                        <div className="h-1 w-3 bg-[#FFD166] rounded-full" />
                        给每一站配张照片
                      </span>
                      <span className="normal-case tracking-normal font-bold" style={{ color: "var(--text-faint)" }}>
                        {Object.keys(uploads).length}/{genStops.length}
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                      {genStops.map((s, idx) => {
                        const photo = uploads[idx];
                        return (
                          <button
                            key={idx}
                            onClick={() => pickPhoto(idx)}
                            className="group relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border active:scale-95 transition-transform"
                            style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)" }}
                          >
                            {photo ? (
                              <>
                                <img src={photo} alt={s.name} className="absolute inset-0 h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                <div className="absolute bottom-1 left-1 right-1 truncate text-[9px] font-bold text-[var(--text-primary)]">{s.emoji} {s.name}</div>
                                <div className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100">
                                  <RotateCcw size={11} />
                                </div>
                              </>
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-1 text-center">
                                <ImagePlus size={20} style={{ color: "var(--text-muted)" }} />
                                <div className="text-base">{s.emoji}</div>
                                <div className="truncate w-full text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>{s.name}</div>
                              </div>
                            )}
                            <div className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#6C5CFF] text-[9px] font-black text-white">{idx + 1}</div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px]" style={{ color: "var(--text-faint)" }}>不上传也行，缺的用示例素材图自动补上。</p>
                  </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                  </>
                  ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <MapPinned size={32} style={{ color: "var(--text-muted)" }} />
                    <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>还没有今日路线</p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>先去探索，打卡后这里会出现素材集</p>
                  </div>
                  )}

                  {canGenerate ? (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setPickerOpen(true)}
                      className="group relative mt-4 h-14 w-full flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#6C5CFF]/10 border border-[#6C5CFF]/30 active:scale-95 transition-all"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#6C5CFF]/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="relative flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#6C5CFF] flex items-center justify-center shadow-[0_0_15px_rgba(108,92,255,0.4)]">
                          <Sparkles size={16} className="text-white fill-white" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[15px] font-black" style={{ color: "var(--text-primary)" }}>生成今日 AI Vlog</span>
                          <span className="text-[10px] font-bold" style={{ color: "var(--text-faint)" }}>选个风格 · 消耗 50 积分</span>
                        </div>
                      </div>
                    </motion.button>
                  ) : (
                    // 还没跑探索 → 没有真实路线，引导去探索（Vlog 依赖路线做地图回放）
                    <div className="mt-4">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onNavigate("explore")}
                        className="group relative h-14 w-full flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#6C5CFF] active:scale-95 transition-all shadow-[0_8px_24px_rgba(108,92,255,0.35)]"
                      >
                        <MapPinned size={18} className="text-white" />
                        <span className="text-[15px] font-black text-white">先去探索生成今天的路线</span>
                        <ChevronRight size={18} className="text-[var(--text-secondary)]" />
                      </motion.button>
                      <p className="mt-2 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>
                        Vlog 是今天这趟走法的记录，跑完探索就能为每一站配图、一键生成。
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-3">
                  {/* 本 session 真实生成的 Vlog —— 可点击重播 */}
                  {realHistory.map(({ vlog, date, duration, img }, idx) => (
                    <motion.button
                      key={vlog.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setPlayingVlog(vlog)}
                      className="group relative overflow-hidden rounded-2xl border border-[#6C5CFF]/30 bg-[#6C5CFF]/[0.06] p-3 flex gap-3 text-left active:bg-[#6C5CFF]/[0.12] transition-colors"
                    >
                      <div className="relative h-20 w-24 rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: "var(--bg-input)" }}>
                        <img src={img} alt={vlog.title} className={`absolute inset-0 h-full w-full object-cover ${STYLE_META[vlog.style].filter} transition-transform duration-500 group-hover:scale-110`} />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                          <PlayCircle size={28} className="text-white" />
                        </div>
                        <div className="absolute bottom-1 right-1 rounded px-1 py-0.5 bg-black/60 text-[8px] font-bold text-white">{duration}</div>
                      </div>
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: "var(--text-faint)" }}>
                          {date}
                          <span className="rounded-full px-1.5 py-0.5 text-[8px] font-black" style={{ background: `${STYLE_META[vlog.style].accent}22`, color: STYLE_META[vlog.style].accent }}>
                            {STYLE_META[vlog.style].label}
                          </span>
                        </div>
                        <h3 className="text-[15px] font-bold truncate mt-0.5" style={{ color: "var(--text-primary)" }}>{vlog.title}</h3>
                        <div className="mt-2 flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                          <span className="flex items-center gap-1 font-bold text-[#A98BFF]"><Music size={11} /> {vlog.bgm}</span>
                        </div>
                      </div>
                    </motion.button>
                  ))}

                  {/* 探索旅程卡片 */}
                  {tripHistory.map((trip, idx) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      idx={idx}
                      delayOffset={realHistory.length}
                      onReact={onTripReaction}
                      onWaypointReact={onWaypointReaction}
                      onFeedback={onTripFeedback}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <BottomNav active="story" onNavigate={onNavigate} />

      <AnimatePresence>
        {pickerOpen && (
          <StylePickerOverlay
            onPick={startGeneration}
            onCancel={() => setPickerOpen(false)}
          />
        )}
        {isGenerating && (
          <VlogGenerationOverlay ready={genReady} onFinish={finishGeneration} />
        )}
        {playingVlog && (
          <VlogPlayerOverlay
            vlog={playingVlog}
            onClose={() => {
              setPlayingVlog(null);
              setActiveTab(1); // 关掉播放器回到历史 tab
            }}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

// ── 风格选择浮层 ──────────────────────────────────────────
function TripCard({ trip, idx, delayOffset, onReact, onWaypointReact, onFeedback }: {
  key?: string;
  trip: TripRecord;
  idx: number;
  delayOffset: number;
  onReact?: (tripId: string, emoji: string) => void;
  onWaypointReact?: (tripId: string, waypointIdx: number, emoji: string) => void;
  onFeedback?: (tripId: string, text: string) => void;
}) {
  const [showPicker, setShowPicker] = React.useState(false);
  const [activeWp, setActiveWp] = React.useState<number | null>(null);
  const [showFeedbackInput, setShowFeedbackInput] = React.useState(false);
  const [feedbackText, setFeedbackText] = React.useState(trip.feedback ?? "");
  const feedbackRef = React.useRef<HTMLTextAreaElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const dayLabel = trip.date === today ? "今天" : trip.date.slice(5).replace("-", ".");
  const visitedCount = trip.waypoints.filter((w) => w.visited).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (delayOffset + idx) * 0.05 }}
      className="overflow-hidden rounded-2xl border p-4"
      style={{ backgroundColor: "var(--bg-card)", borderColor: trip.date === today ? "rgba(108,92,255,0.3)" : "var(--border-subtle)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{dayLabel}</span>
        <button
          onClick={() => { setShowPicker(!showPicker); setActiveWp(null); }}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 active:scale-90 transition-transform"
          style={{ backgroundColor: trip.reaction ? undefined : "var(--bg-input)" }}
        >
          {trip.reaction
            ? <span className="text-[18px]">{trip.reaction}</span>
            : <span className="text-[11px] font-bold" style={{ color: "var(--text-faint)" }}>+ 评价</span>
          }
        </button>
      </div>

      <AnimatePresence>
        {showPicker && activeWp === null && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex justify-center gap-2 pt-2 pb-1">
              {REACTION_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onReact?.(trip.id, emoji); setShowPicker(false); }}
                  className={`text-[24px] active:scale-125 transition-transform ${trip.reaction === emoji ? "scale-125" : ""}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 flex flex-col gap-1.5">
        {trip.waypoints.filter((w) => !(w.isHidden && !w.visited)).map((w, wi) => (
          <div key={wi} className="flex items-center gap-2">
            <span className={`text-[18px] ${w.visited ? "" : "opacity-30 grayscale"}`}>{w.emoji}</span>
            <span className="flex-1 text-[13px] font-medium truncate" style={{ color: w.visited ? "var(--text-secondary)" : "var(--text-faint)" }}>
              {w.name}
              {w.isHidden && <span className="ml-1 text-[9px] font-bold text-amber-400">隐藏</span>}
            </span>
            <button
              onClick={() => setActiveWp(activeWp === wi ? null : wi)}
              className="shrink-0 rounded-full px-1.5 py-0.5 active:scale-90 transition-transform"
              style={{ backgroundColor: w.reaction ? undefined : "var(--bg-input)" }}
            >
              {w.reaction
                ? <span className="text-[14px]">{w.reaction}</span>
                : <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>+</span>
              }
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {activeWp !== null && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-center gap-2 pt-2 pb-1">
              <span className="text-[10px] font-bold mr-1" style={{ color: "var(--text-faint)" }}>{trip.waypoints[activeWp]?.name}：</span>
              {REACTION_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onWaypointReact?.(trip.id, activeWp, emoji); setActiveWp(null); }}
                  className={`text-[20px] active:scale-125 transition-transform ${trip.waypoints[activeWp]?.reaction === emoji ? "scale-125" : ""}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-2 flex items-center gap-2 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
        <span>{visitedCount}站</span>
        <span>·</span>
        <span>{trip.distanceKm}km</span>
        <span>·</span>
        <span>{trip.durationMin}min</span>
      </div>
      {trip.rewards.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {trip.rewards.slice(0, 3).map((r, ri) => (
            <span key={ri} className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-[#6C5CFF]/10 text-[#A98BFF]">{r}</span>
          ))}
          {trip.rewards.length > 3 && (
            <span className="text-[9px] font-bold" style={{ color: "var(--text-faint)" }}>+{trip.rewards.length - 3}</span>
          )}
        </div>
      )}

      {trip.feedback && !showFeedbackInput && (
        <button
          onClick={() => setShowFeedbackInput(true)}
          className="mt-2 w-full rounded-lg px-3 py-1.5 text-left text-[12px] italic"
          style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}
        >
          "{trip.feedback}"
        </button>
      )}

      {!trip.feedback && !showFeedbackInput && (
        <button
          onClick={() => { setShowFeedbackInput(true); setTimeout(() => feedbackRef.current?.focus(), 100); }}
          className="mt-2 flex items-center gap-1 text-[11px] font-bold"
          style={{ color: "var(--text-faint)" }}
        >
          <span>✏️</span> 写点感想
        </button>
      )}

      <AnimatePresence>
        {showFeedbackInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <textarea
              ref={feedbackRef}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value.slice(0, 100))}
              placeholder="这趟旅程有什么想说的..."
              rows={2}
              className="mt-2 w-full resize-none rounded-xl border px-3 py-2 text-[12px] outline-none transition-colors focus:border-[#6C5CFF]"
              style={{
                backgroundColor: "var(--bg-input)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
              autoFocus
            />
            <div className="mt-1 flex items-center justify-between px-1">
              <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                {feedbackText.length}/100
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowFeedbackInput(false); setFeedbackText(trip.feedback ?? ""); }}
                  className="text-[11px] font-bold"
                  style={{ color: "var(--text-faint)" }}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    const trimmed = feedbackText.trim();
                    if (trimmed) onFeedback?.(trip.id, trimmed);
                    setShowFeedbackInput(false);
                  }}
                  className="rounded-full px-4 py-1 text-[11px] font-bold text-white"
                  style={{ backgroundColor: "#6C5CFF" }}
                >
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StylePickerOverlay({ onPick, onCancel }: { onPick: (s: VlogStyle) => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[105] flex flex-col items-center justify-end bg-black/60 backdrop-blur-md"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 320 }}
        animate={{ y: 0 }}
        exit={{ y: 320 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-3xl border-t p-6 pb-10"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ backgroundColor: "var(--text-faint)" }} />
        <h2 className="text-[18px] font-black" style={{ color: "var(--text-primary)" }}>选择 Vlog 风格</h2>
        <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>AI 会用对应的画面滤镜、旁白语气和 BGM 剪辑</p>

        <div className="mt-5 space-y-3">
          {STYLE_ORDER.map((s, i) => {
            const m = STYLE_META[s];
            return (
              <motion.button
                key={s}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPick(s)}
                className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border p-3 text-left"
                style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)" }}
              >
                <div className={`h-14 w-14 shrink-0 rounded-xl ${m.preview} shadow-lg`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-black" style={{ color: "var(--text-primary)" }}>{m.label}</div>
                  <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>{m.desc}</div>
                </div>
                <div className="rounded-full p-2 transition-colors" style={{ color: m.accent }}>
                  <Play size={18} className="fill-current" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// 进度条跟真实生成走：未完成时爬到 ~90% 等待，ready 后冲到 100% 再 onFinish
function VlogGenerationOverlay({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState("分析素材集...");
  const readyRef = React.useRef(ready);
  readyRef.current = ready;

  const steps = [
    { threshold: 0, text: "正在分析今日深度足迹...", icon: <Wand2 size={20} /> },
    { threshold: 25, text: "提取画面精彩瞬间...", icon: <Film size={20} /> },
    { threshold: 50, text: "正在进行 AI 智能配音...", icon: <Music size={20} /> },
    { threshold: 75, text: "后期光影特效处理中...", icon: <Sparkles size={20} /> },
    { threshold: 95, text: "正在导出 Vlog...", icon: <Loader2 size={20} className="animate-spin" /> },
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onFinish, 800);
          return 100;
        }
        // AI 还没返回时最多爬到 90%，返回后一路冲到 100%
        const cap = readyRef.current ? 100 : 90;
        if (prev >= cap) return prev;
        const next = Math.min(prev + Math.random() * 5, cap);
        const currentStep = steps.findLast(s => next >= s.threshold);
        if (currentStep) setStatus(currentStep.text);
        return next;
      });
    }, 150);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[110] flex flex-col items-center justify-center backdrop-blur-xl"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] bg-[#6C5CFF]/30 blur-[120px] rounded-full animate-pulse" />
      </div>

      <div className="relative flex flex-col items-center px-10 text-center">
        <div className="relative mb-12">
          {/* Animated rings */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full border border-[#6C5CFF]/20 animate-[ping_3s_infinite]" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-full border border-[#6C5CFF]/40 animate-[ping_2s_infinite]" />

          <div className="h-20 w-20 rounded-3xl bg-[#6C5CFF] flex items-center justify-center shadow-[0_0_50px_rgba(108,92,255,0.6)] relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={status}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
              >
                {progress < 100 ? (
                  steps.findLast(s => progress >= s.threshold)?.icon
                ) : (
                  <CheckCircle2 size={32} className="text-white" />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <h2 className="text-2xl font-black italic tracking-tight mb-2" style={{ color: "var(--text-primary)" }}>
          {progress < 100 ? "AI 正在创作中" : "制作完成！"}
        </h2>
        <div className="flex items-center gap-2 text-[var(--text-muted)] text-[13px] font-medium h-6">
          <AnimatePresence mode="wait">
            <motion.span
              key={status}
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -5, opacity: 0 }}
              className="flex items-center gap-2"
            >
              {status}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="mt-12 w-64 h-1.5 rounded-full overflow-hidden relative" style={{ backgroundColor: "var(--bg-input)" }}>
          <motion.div 
            className="absolute inset-y-0 left-0 bg-[#6C5CFF] shadow-[0_0_15px_rgba(108,92,255,1)]"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        </div>
        
        <div className="mt-4 text-[12px] font-mono font-bold text-[#6C5CFF]">
          {Math.round(progress)}%
        </div>
      </div>
    </motion.div>
  );
}

// ── Vlog 播放器：分镜自动推进的竖屏成片 ──────────────────────
function VlogPlayerOverlay({ vlog, onClose }: { vlog: GeneratedVlog; onClose: () => void }) {
  const theme = STYLE_META[vlog.style];
  const hasGeo = !!vlog.geo && vlog.geo.legs.length > 0;
  // 有真实路线 → 先放路线回放；否则直接进战报卡
  const [phase, setPhase] = React.useState<"replay" | "card">(hasGeo ? "replay" : "card");
  const [replayKey, setReplayKey] = React.useState(0); // 重播时强制 RouteReplay 重挂
  const [photoStop, setPhotoStop] = React.useState<number | null>(null); // 到站时显示该站照片特写
  const [copied, setCopied] = React.useState(false);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${vlog.title}｜${vlog.verdict}\n${vlog.shareCaption}`);
    } catch { /* 忽略：仍提示已复制 */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const replay = () => {
    setPhotoStop(null);
    setReplayKey((k) => k + 1);
    setPhase("replay");
  };

  const photoScene = photoStop != null ? vlog.scenes[photoStop] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[120] overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* ── 路线回放 ── */}
      {phase === "replay" && hasGeo && (
        <div className="absolute inset-0">
          <div key={replayKey} className="absolute inset-0">
            <RouteReplay
              geo={vlog.geo!}
              accent={theme.accent}
              onStopChange={setPhotoStop}
              onDone={() => setPhase("card")}
            />
          </div>

          {/* 到站 → 切到该站照片的 Live2D 特写（盖在地图上） */}
          <AnimatePresence>
            {photoScene && (
              <motion.div
                key={photoStop}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45 }}
                className="absolute inset-0 z-[5]"
              >
                <LivePhoto
                  frame={photoScene.frame}
                  style={vlog.style}
                  filter={theme.filter}
                  overlay={theme.overlay}
                  accent={theme.accent}
                  emoji={photoScene.emoji}
                  caption={photoScene.caption}
                  narration={photoScene.narration}
                  label={`第 ${photoStop! + 1} 站 / ${vlog.geo!.stops.length}`}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* 顶部标题条 + 关闭 + 跳过 */}
          <div className="absolute inset-x-0 top-8 z-10 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: `${theme.accent}33`, color: theme.accent }}>
                {theme.label}
              </span>
              <span className="text-[13px] font-black italic drop-shadow" style={{ color: "var(--text-primary)" }}>{vlog.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPhase("card")} className="rounded-full px-3 py-1.5 text-[11px] font-bold active:scale-90" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>跳过</button>
              <button onClick={onClose} className="rounded-full p-2 active:scale-90" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}><X size={18} /></button>
            </div>
          </div>
          {/* BGM chip */}
          <div className="pointer-events-none absolute bottom-3 right-4 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
            <Music size={11} style={{ color: theme.accent }} /> {vlog.bgm}
          </div>
        </div>
      )}

      {/* ── City Walk 战报卡 ── */}
      {phase === "card" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col overflow-y-auto no-scrollbar" style={{ backgroundColor: "var(--bg-base)" }}>
          <div className={`absolute inset-0 ${theme.preview} opacity-[0.10]`} />
          <button onClick={onClose} className="absolute right-5 top-12 z-20 rounded-full p-2 active:scale-90" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}><X size={20} /></button>

          <div className="relative z-10 mx-auto w-full max-w-sm px-6 pb-10 pt-16">
            <div className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: theme.accent }}>
              {theme.label} · City Walk 战报
            </div>
            <h2 className="mt-1.5 text-[26px] font-black italic leading-tight" style={{ color: "var(--text-primary)" }}>{vlog.title}</h2>
            {/* 人格金句 */}
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor: `${theme.accent}55`, background: `${theme.accent}1A` }}>
              <Sparkles size={14} style={{ color: theme.accent }} />
              <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>{vlog.verdict}</span>
            </div>

            {/* 路线缩略图（静态全貌） */}
            {hasGeo && (
              <div className="mt-5 h-44 w-full overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-base)" }}>
                <RouteReplay geo={vlog.geo!} accent={theme.accent} frozen />
              </div>
            )}

            {/* 数据 */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {hasGeo ? (
                <>
                  <StatCell icon={<Footprints size={16} />} value={`${vlog.geo!.distanceKm}`} unit="km" accent={theme.accent} />
                  <StatCell icon={<MapPinned size={16} />} value={`${vlog.geo!.stops.length}`} unit="个打卡点" accent={theme.accent} />
                  <StatCell icon={<Ticket size={16} />} value={`${vlog.geo!.stops.length}`} unit="张奖励" accent={theme.accent} />
                </>
              ) : (
                <>
                  <StatCell icon={<Film size={16} />} value={`${vlog.scenes.length}`} unit="个分镜" accent={theme.accent} />
                  <StatCell icon={<Footprints size={16} />} value={fmtDuration(vlog.scenes)} unit="时长" accent={theme.accent} />
                  <StatCell icon={<Music size={16} />} value="BGM" unit={vlog.bgm.split(" ")[0]} accent={theme.accent} />
                </>
              )}
            </div>

            {/* 分享文案 */}
            <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)" }}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                <Music size={11} /> {vlog.bgm}
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{vlog.shareCaption}</p>
            </div>

            {/* 操作 */}
            <div className="mt-6 flex gap-3">
              {hasGeo && (
                <button onClick={replay} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3.5 text-[14px] font-bold active:scale-95" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}>
                  <RotateCcw size={16} /> 重看回放
                </button>
              )}
              <button onClick={share} className="flex flex-[1.4] items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-black text-black active:scale-95" style={{ background: theme.accent }}>
                {copied ? <><Check size={16} /> 已复制</> : <><Share2 size={16} /> 分享战报</>}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function StatCell({ icon, value, unit, accent }: { icon: React.ReactNode; value: string; unit: string; accent: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border py-3" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)" }}>
      <div style={{ color: accent }}>{icon}</div>
      <div className="mt-1 text-[18px] font-black leading-none" style={{ color: "var(--text-primary)" }}>{value}</div>
      <div className="mt-0.5 text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{unit}</div>
    </div>
  );
}

function StoryHero() {
  return (
    <Glass className="relative overflow-hidden p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(108,92,255,.25),transparent_25%)]" />
      <div className="relative z-10 w-[65%]">
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          今日故事 <span className="rounded-full bg-[#FF4D64] px-1 py-0.5 text-[8px] font-bold text-white">NEW</span>
        </div>
        <h2 className="mt-2 text-[18px] font-bold leading-tight uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>城市里的小确幸</h2>
        <p className="mt-2 text-[12px] leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>在这条无名小巷，你发现了惊喜。</p>
        <button className="mt-4 rounded-full bg-[#6C5CFF]/80 px-5 py-2 text-[11px] font-bold">
          查看详情
        </button>
      </div>
      <motion.div 
        animate={{ rotate: [4, 6, 4], y: [0, -3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-4 top-1/2 -translate-y-1/2 h-[100px] w-[80px] rounded-lg border-[3px] border-white bg-black/40 overflow-hidden shadow-xl"
      >
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2A1D35] to-[#9B6B3D]">
          <PlayCircle size={32} className="text-white/60" />
        </div>
      </motion.div>
    </Glass>
  );
}

interface TimelineItemProps extends TimelineItemData {
  index: number;
  key?: string | number;
}

function TimelineItem({ time, title, desc, icon, img, recorded, index }: TimelineItemProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative flex gap-4"
    >
      <div className="flex w-[32px] flex-col items-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6C5CFF]/20 text-[#A98BFF] ring-1 ring-[#6C5CFF]/40 z-10">
          {React.cloneElement(icon as React.ReactElement, { size: 14 })}
        </div>
        <div className="mt-1 flex-1 w-px min-h-[40px]" style={{ backgroundColor: "var(--border-subtle)" }} />
      </div>
      <div className="flex flex-1 gap-3 rounded-xl p-3 mb-3 border" style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-subtle)" }}>
        <div className="w-10 shrink-0 text-[11px] font-mono pt-0.5" style={{ color: "var(--text-faint)" }}>{time}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>{title}</div>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
        </div>
        <div className={`h-12 w-12 shrink-0 rounded-lg ${img} border opacity-80`} style={{ borderColor: "var(--border-subtle)" }} />
      </div>
    </motion.div>
  );
}
