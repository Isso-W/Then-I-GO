import React from "react";
import { MapPin, Gift, Coffee, Star, PlayCircle, ChevronDown, Sparkles, X, Loader2, Wand2, Film, Music, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";
import { BottomNav, PageTitle, TabBar } from "../components/CommonUI";
import { ScreenType, TimelineItemData } from "../types";

export function StoryScreen({ onNavigate }: { onNavigate: (s: ScreenType) => void }) {
  const [activeTab, setActiveTab] = React.useState(0);
  const [selectedDate, setSelectedDate] = React.useState("今日");
  const [isGenerating, setIsGenerating] = React.useState(false);

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

  const currentItems = itemsByDate[selectedDate] || [
    { time: "15:00", title: "日常记录", desc: "在这个城市的惬意午后。", icon: <MapPin size={17} />, img: "bg-gradient-to-br from-slate-700 to-slate-900" }
  ];

  const historicalVlogs = [
    { id: 1, date: "2024.05.23", title: "五道口雨后漫步", duration: "01:24", views: 128, img: "https://images.unsplash.com/photo-1559564484-e48b3e040ff4?auto=format&fit=crop&w=400&q=80" },
    { id: 2, date: "2024.05.20", title: "周末的艺术之旅", duration: "02:10", views: 256, img: "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=400&q=80" },
    { id: 3, date: "2024.05.15", title: "重访清华西门", duration: "00:58", views: 89, img: "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=400&q=80" },
  ];

  return (
    <AppLayout>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_15%,rgba(108,92,255,.18),transparent_30%)]" />
      <PageTitle 
        title="故事" 
        right={
          <button className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] text-white/80 bg-white/5">
            拍摄设置 <ChevronDown size={12} />
          </button>
        } 
      />
      
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
                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                        }`}
                      >
                        {date === "今日" ? "今日" : date}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mb-4 text-[11px] text-white/30 uppercase tracking-widest font-black">
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

                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsGenerating(true)}
                    className="group relative mt-4 h-14 w-full flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#6C5CFF]/10 border border-[#6C5CFF]/30 active:scale-95 transition-all"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#6C5CFF]/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <div className="relative flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#6C5CFF] flex items-center justify-center shadow-[0_0_15px_rgba(108,92,255,0.4)]">
                        <Sparkles size={16} className="text-white fill-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[15px] font-black text-white">生成今日 AI Vlog</span>
                        <span className="text-[10px] text-white/30 font-bold">消耗 50 积分</span>
                      </div>
                    </div>
                  </motion.button>
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
                  {historicalVlogs.map((vlog, idx) => (
                    <motion.div
                      key={vlog.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] p-3 flex gap-3 active:bg-white/[0.06] transition-colors"
                    >
                      <div className="relative h-20 w-24 rounded-xl overflow-hidden shrink-0 bg-white/5">
                        <img 
                          src={vlog.img} 
                          alt={vlog.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                          <PlayCircle size={28} className="text-white/80" />
                        </div>
                        <div className="absolute bottom-1 right-1 rounded px-1 py-0.5 bg-black/60 text-[8px] font-bold text-white">
                          {vlog.duration}
                        </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="text-[10px] text-white/30 font-bold">{vlog.date}</div>
                        <h3 className="text-[15px] font-bold text-white/90 truncate mt-0.5">{vlog.title}</h3>
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-white/40">
                          <span className="flex items-center gap-1 font-bold text-[#6C5CFF]">分享</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <BottomNav active="story" onNavigate={onNavigate} />

      <AnimatePresence>
        {isGenerating && (
          <VlogGenerationOverlay onFinish={() => {
            setIsGenerating(false);
            setActiveTab(1); // Switch to history tab
          }} onCancel={() => setIsGenerating(false)} />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

function VlogGenerationOverlay({ onFinish, onCancel }: { onFinish: () => void, onCancel: () => void }) {
  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState("分析素材集...");
  
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
          setTimeout(onFinish, 1000);
          return 100;
        }
        const next = prev + Math.random() * 5;
        const currentStep = steps.findLast(s => next >= s.threshold);
        if (currentStep) setStatus(currentStep.text);
        return next > 100 ? 100 : next;
      });
    }, 150);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl"
    >
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] bg-[#6C5CFF]/30 blur-[120px] rounded-full animate-pulse" />
      </div>

      <button 
        onClick={onCancel}
        className="absolute top-12 right-6 p-2 rounded-full bg-white/5 text-white/40 active:scale-90"
      >
        <X size={20} />
      </button>

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

        <h2 className="text-2xl font-black text-white italic tracking-tight mb-2">
          {progress < 100 ? "AI 正在创作中" : "制作完成！"}
        </h2>
        <div className="flex items-center gap-2 text-white/40 text-[13px] font-medium h-6">
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

        <div className="mt-12 w-64 h-1.5 bg-white/5 rounded-full overflow-hidden relative">
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

function StoryHero() {
  return (
    <Glass className="relative overflow-hidden p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(108,92,255,.25),transparent_25%)]" />
      <div className="relative z-10 w-[65%]">
        <div className="flex items-center gap-1.5 text-[11px] text-white/50">
          今日故事 <span className="rounded-full bg-[#FF4D64] px-1 py-0.5 text-[8px] font-bold">NEW</span>
        </div>
        <h2 className="mt-2 text-[18px] font-bold leading-tight uppercase tracking-tight">城市里的小确幸</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-white/40 line-clamp-2">在这条无名小巷，你发现了惊喜。</p>
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
        <div className="mt-1 flex-1 w-px bg-white/5 min-h-[40px]" />
      </div>
      <div className="flex flex-1 gap-3 rounded-xl bg-white/[0.02] p-3 mb-3 border border-white/5">
        <div className="w-10 shrink-0 text-[11px] font-mono text-white/30 pt-0.5">{time}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-white/90">{title}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-white/50">{desc}</p>
        </div>
        <div className={`h-12 w-12 shrink-0 rounded-lg ${img} border border-white/5 opacity-80`} />
      </div>
    </motion.div>
  );
}
