import React, { useState, useEffect } from "react";
import { Sparkles, Zap, BookOpen, Compass, Gift, Navigation, HelpCircle, Clock, RotateCcw, CheckCircle2, ChevronDown, MapPin, ExternalLink, Camera, X, RefreshCw, Bike, Rocket, Target, Layers, ChevronLeft, Smile, Frown, Meh, Wind, Utensils, Search, Palette, Mountain, Coffee, Book, Users, CameraIcon, Gem, PiggyBank, Flame, Pizza, Wand2, Smartphone, Battery, Umbrella, CreditCard, Info, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";
import { BottomNav } from "../components/CommonUI";
import { Map } from "../components/Map";
import type { LatLng } from "../components/mapProjection";
import { ScreenType, ExploreStep, UserPreferences, GeneratedRoute, Waypoint, RouteBranch } from "../types";

export function ExploreScreen({
  onNavigate,
  step,
  setStep,
  onPreferenceConfirm,
  onDirectStart,
  generatedRoute,
  currentPosition,
  onUserDrag,
  onBranchChoice,
}: {
  onNavigate: (s: ScreenType) => void;
  step: ExploreStep;
  setStep: (s: ExploreStep) => void;
  onPreferenceConfirm: (prefs: UserPreferences) => void;
  onDirectStart: () => void;
  generatedRoute: GeneratedRoute | null;
  currentPosition: LatLng;
  onUserDrag?: (p: LatLng) => void;
  onBranchChoice: (index: number) => void;
}) {

  const handleInitialComplete = () => {
    setStep("checkin_initial");
  };

  const handleInitialCheckin = () => {
    setStep("hidden_found");
  };

  const startHiddenTask = () => {
    setStep("hidden_active");
  };

  const handleHiddenCheckin = () => {
    setStep("reward_hidden");
  };

  const isGameStarted = !["intro", "preference_selection"].includes(step);
  const isCapturing = ["checkin_initial", "checkin_hidden", "checkin_next"].includes(step);

  return (
    <AppLayout>
      <div className="absolute inset-0 z-0 overflow-hidden bg-[#07101d]">
        <Map route={generatedRoute} currentPosition={currentPosition} onUserDrag={onUserDrag} step={step} />
      </div>
      <FogLayer />
      {(step === "intro" || (isGameStarted && !isCapturing)) && <ExploreHeader />}
      {isGameStarted && !isCapturing && <ProgressPanel step={step} />}
      {isGameStarted && !isCapturing && <UnknownMarkers step={step} />}
      {isGameStarted && !isCapturing && <FloatingActions onAction={(a) => a === 'event' && onNavigate('event')} />}
      {isGameStarted && !isCapturing && <Legend step={step} />}
      
      <AnimatePresence>
        {step === "intro" && (
          <IntroOverlay
            key="intro"
            onDirectStart={onDirectStart}
            onCustomize={() => setStep("preference_selection")}
          />
        )}
        {step === "preference_selection" && (
          <PreferenceOverlay key="preference" onConfirm={onPreferenceConfirm} onBack={() => setStep("intro")} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === "hidden_found" && (
          <HiddenTaskAlert hiddenTask={generatedRoute?.hiddenTask} onAccept={startHiddenTask} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGameStarted && !isCapturing && step !== "branch_choice" && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute left-5 right-5 z-40 bottom-[90px]"
          >
            <TaskCard
              step={step}
              onComplete={handleInitialComplete}
              onCheckIn={() => {
                if (step === "initial") setStep("checkin_initial");
                if (step === "hidden_active") setStep("checkin_hidden");
                if (step === "next_objective") setStep("checkin_next");
              }}
              generatedRoute={generatedRoute}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {isCapturing && (
          <CameraInterface 
            onCapture={() => {
              if (step === "checkin_initial") handleInitialCheckin();
              if (step === "checkin_hidden") handleHiddenCheckin();
              if (step === "checkin_next") setStep("achievement_unlock");
            }} 
            onClose={() => {
              if (step === "checkin_initial") setStep("initial");
              if (step === "checkin_hidden") setStep("hidden_active");
              if (step === "checkin_next") setStep("next_objective");
            }} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === "reward_hidden" && (
          <RewardOverlay 
            onContinue={() => setStep(generatedRoute?.branch ? "branch_choice" : "next_objective")}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === "branch_choice" && (
          <BranchChoiceOverlay branch={generatedRoute?.branch} onPick={onBranchChoice} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === "achievement_unlock" && (
          <AchievementOverlay onContinue={() => setStep("intro")} />
        )}
      </AnimatePresence>

      <BottomNav active="explore" onNavigate={onNavigate} />
    </AppLayout>
  );
}

function FogLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <motion.div 
        animate={{ x: [0, 20, 0], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute -left-28 top-[25%] h-44 w-80 rounded-full bg-slate-300/20 blur-2xl" 
      />
      <motion.div 
        animate={{ x: [0, -30, 0], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute -right-24 top-[20%] h-52 w-96 rounded-full bg-slate-300/20 blur-3xl" 
      />
      <div className="absolute left-[10%] bottom-[30%] h-40 w-80 rounded-full bg-slate-300/24 blur-3xl" />
      <div className="absolute right-[-10%] bottom-[20%] h-48 w-80 rounded-full bg-slate-300/18 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_58%,transparent_0%,transparent_24%,rgba(10,10,26,0.18)_45%,rgba(10,10,26,0.72)_100%)]" />
    </div>
  );
}

function ExploreHeader() {
  return (
    <header className="absolute left-5 right-5 top-[56px] z-30 flex items-start justify-between">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <h1 className="flex items-center gap-2 text-[24px] font-bold leading-none text-white drop-shadow-lg">
          那我走 <Sparkles size={14} className="text-[#FFD166]" />
        </h1>
        <p className="mt-1.5 text-[12px] text-[#D7D7E8]/80 font-medium">你只管出门，剩下由系统决定</p>
      </motion.div>
      <button className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1.5 px-3 text-[11px] text-white backdrop-blur-md transition-all active:scale-95">
        <BookOpen size={14} />日志
      </button>
    </header>
  );
}

function ProgressPanel({ step }: { step: ExploreStep }) {
  return (
    <Glass className="absolute left-4 top-[120px] z-20 w-[115px] p-2.5 text-white bg-[#0F172A]/80">
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 opacity-60 font-medium">
          <Zap size={12} className="fill-[#FFD166] text-[#FFD166]" />
          <span>体力</span>
        </div>
        <span className="font-bold text-[#FFD166]">85</span>
      </div>
    </Glass>
  );
}

function UnknownMarkers({ step }: { step: ExploreStep }) {
  if (step !== "initial" && step !== "hidden_found") return null;
  
  return (
    <>
      <motion.div 
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute right-[20%] top-[45%] z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-bold text-white/20 backdrop-blur-sm"
      >
        ?
      </motion.div>
      <motion.div 
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 5, repeat: Infinity }}
        className="absolute left-[25%] top-[55%] z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl font-bold text-white/20 backdrop-blur-sm"
      >
        ?
      </motion.div>
    </>
  );
}

function FloatingActions({ onAction }: { onAction: (a: string) => void }) {
  return (
    <div className="absolute left-5 bottom-[115px] z-30 flex flex-col gap-2">
      <button className="flex h-12 w-12 flex-col items-center justify-center rounded-full border border-white/10 bg-[#10142c]/60 text-white shadow-lg backdrop-blur-md active:scale-90 overflow-hidden">
        <Compass size={18} className="text-[#A98BFF]" />
        <span className="mt-0.5 text-[8px] opacity-70">重置</span>
      </button>
      <button 
        onClick={() => onAction('event')}
        className="relative flex h-12 w-12 flex-col items-center justify-center rounded-full border border-white/10 bg-[#10142c]/60 text-white shadow-lg backdrop-blur-md active:scale-95"
      >
        <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF4D64] text-[9px] font-bold">2</span>
        <Gift size={20} className="fill-[#FFD166] text-[#FFD166]" />
        <span className="mt-0.5 text-[8px] opacity-70">事件</span>
      </button>
    </div>
  );
}

function Legend({ step }: { step?: ExploreStep }) {
  const isIntro = step === "intro";
  return (
    <div className="absolute right-5 bottom-[40%] z-30 flex flex-col gap-3">
      <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1A2E]/80 border border-white/10 text-white/40 shadow-lg active:scale-95">
        <HelpCircle size={20} />
      </button>
      <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1A2E]/80 border border-white/10 text-white shadow-lg active:scale-95">
        <Target size={20} />
      </button>
      <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1A2E]/80 border border-white/10 text-white shadow-lg active:scale-95">
        <Layers size={20} />
      </button>
    </div>
  );
}

function TaskCard({ step, onComplete, onCheckIn, generatedRoute }: {
  step: ExploreStep;
  onComplete: () => void;
  onCheckIn: () => void;
  generatedRoute: GeneratedRoute | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isHiddenActive = step === "hidden_active" || step === "checkin_hidden";
  const isInitial = step === "initial" || step === "checkin_initial";
  const isNext = step === "next_objective" || step === "checkin_next";

  const wp0 = generatedRoute?.waypoints[0];
  const wp1 = generatedRoute?.waypoints[1];
  const hidden = generatedRoute?.hiddenTask;

  const getTaskContent = () => {
    if (isInitial) return {
      title: wp0?.name ?? "前往第一站",
      desc: wp0?.task ?? "前方直走100m|预计6min到达",
      detail: wp0?.description ?? "目的地在地下，那里夏凉冬不凉",
      reward: wp0?.reward ?? "+10 XP",
      color: "#6C5CFF",
    };
    if (isHiddenActive) return {
      title: hidden?.name ? `秘密：${hidden.name}` : "隐藏坐标",
      desc: hidden?.task ?? "开启特殊的视频打卡",
      detail: hidden?.description ?? "附近藏着一个未公开的坐标，去发现它，完成一次特别打卡。",
      reward: hidden?.reward ?? "+50 XP",
      color: "#F59E0B",
    };
    if (isNext) return {
      title: wp1?.name ?? "前往下一站",
      desc: wp1?.task ?? "左转直走1km|预计12min到达",
      detail: wp1?.description ?? "那里是个即便你发呆四个小时，也会被认为'思考人生'的合法场所",
      reward: wp1?.reward ?? "+20 XP",
      color: "#0066FF",
    };
    return { title: "任务完成", desc: "点击查看后续", detail: "", reward: "+0", color: "#10B981" };
  };

  const content = getTaskContent();

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheckIn();
  };

  return (
    <Glass 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`relative w-full z-40 p-6 text-white overflow-hidden transition-all duration-300 cursor-pointer rounded-[32px] bg-[#0F172A]/90 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br from-[${content.color}]/10 to-transparent pointer-events-none`} />
      
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-[#FFD166]" />
          <h2 className="text-[16px] font-bold uppercase tracking-tight">
            {isInitial ? "首站探索" : isHiddenActive ? "触发：隐藏任务" : isNext ? "今日终点" : "探索中"}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[16px] font-mono font-bold text-white/80">
          <Clock size={14} />
          <span>{isInitial ? "01:45" : isNext ? "12:00" : "∞"}</span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="ml-1 opacity-40"
          >
            <ChevronDown size={16} />
          </motion.div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-white ring-1 ring-white/10">
          <Camera size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold truncate text-white">{content.title}</div>
          <p className="text-[11px] text-white/40 truncate">{content.desc}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
          <span className="text-[13px] font-bold text-[#FFD166]">{content.reward}</span>
          <Zap size={12} className="fill-[#FFD166] text-[#FFD166]" />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3 pt-1">
              <p className="text-[12px] leading-relaxed text-white/50">
                {content.detail}
              </p>
              
              <button 
                onClick={handleAction}
                className="w-full rounded-xl bg-gradient-to-r from-[#6C5CFF] to-[#8F5CFF] py-3 text-[14px] font-bold text-white shadow-lg active:scale-[0.98] transition-transform"
                style={{ backgroundImage: `linear-gradient(to right, ${content.color}, #5B21B6)` }}
              >
                开启打卡 / 记录 VLOG
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Glass>
  );
}

function HiddenTaskAlert({ hiddenTask, onAccept }: { hiddenTask?: Waypoint; onAccept: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center p-8 backdrop-blur-md bg-black/20"
    >
      <div className="relative w-full max-w-sm rounded-[32px] border border-amber-500/30 bg-[#0a0a1a]/90 p-6 text-center shadow-[0_0_50px_rgba(251,191,36,0.3)]">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="relative flex h-24 w-24 items-center justify-center"
          >
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/50" />
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-white shadow-[0_0_20px_rgba(251,191,36,0.8)]">
              <Sparkles size={32} />
            </div>
          </motion.div>
        </div>
        
        <div className="mt-12 space-y-4">
          <div>
            <h2 className="text-[24px] font-black text-amber-100 italic">触发：隐藏记忆</h2>
            <p className="mt-1 text-[13px] text-amber-200/60 tracking-wider">系统检测到附近存在未公开的坐标</p>
          </div>
          
          <div className="rounded-2xl bg-white/5 p-4 text-left border border-white/10">
            <div className="flex items-center gap-2 text-amber-400">
               <MapPin size={16} />
               <span className="text-[14px] font-bold">{hiddenTask?.name ?? "隐藏坐标"}</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-white/50">
              {hiddenTask?.description ?? "附近藏着一个未公开的坐标，藏着这个街区的某个秘密瞬间。"}
            </p>
          </div>
          
          <div className="flex flex-col gap-2 pt-2">
            <button 
              onClick={onAccept}
              className="w-full rounded-2xl bg-amber-500 hover:bg-amber-400 py-4 text-[16px] font-black text-black transition-colors"
            >
              立刻前往
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BranchChoiceOverlay({ branch, onPick }: { branch?: RouteBranch; onPick: (index: number) => void }) {
  if (!branch) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-md bg-black/30"
    >
      <motion.h2
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-5 text-center text-[20px] font-black italic text-white drop-shadow-lg"
      >
        {branch.axis}
      </motion.h2>
      <div className="flex w-full max-w-sm gap-3">
        {branch.options.map((opt, i) => (
          <motion.button
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08 * i }}
            onClick={() => onPick(i)}
            className="flex-1 rounded-3xl border border-white/10 bg-[#14142B]/90 p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,.45)] active:scale-[0.97] transition-transform"
          >
            <div className="text-3xl">{opt.emoji}</div>
            <div className="mt-2 text-[15px] font-bold text-white">{opt.name}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45 line-clamp-3">{opt.description}</p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-[#A98BFF]">
              <MapPin size={11} /> {opt.distanceText}
            </div>
          </motion.button>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-white/40">点一张卡 = 选定第二站</p>
    </motion.div>
  );
}

function CameraInterface({ onCapture, onClose }: { onCapture: () => void, onClose: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(onCapture, 500);
            return 100;
          }
          return prev + 2;
        });
      }, 60);
    }
    return () => clearInterval(interval);
  }, [isRecording, onCapture]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-[100] bg-black"
    >
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541167760496-162955ed8a9f?auto=format&fit=crop&q=80&w=1200')] bg-cover bg-center opacity-80" />
      <div className="absolute inset-0 bg-black/40" />
      
      <div className="relative flex h-full flex-col justify-between p-6 pt-16 pb-12">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="rounded-full bg-black/40 p-2 text-white">
            <X size={24} />
          </button>
          <div className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span className="text-[12px] font-bold text-white tracking-widest">REC</span>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="relative h-[260px] w-[260px]">
            <div className="absolute inset-0 border-2 border-white/20 rounded-3xl" />
            <div className="absolute -left-2 -top-2 h-6 w-6 border-l-4 border-t-4 border-white/80" />
            <div className="absolute -right-2 -top-2 h-6 w-6 border-r-4 border-t-4 border-white/80" />
            <div className="absolute -left-2 -bottom-2 h-6 w-6 border-l-4 border-b-4 border-white/80" />
            <div className="absolute -right-2 -bottom-2 h-6 w-6 border-r-4 border-b-4 border-white/80" />
            
            <div className="absolute inset-4 overflow-hidden rounded-xl bg-white/5 backdrop-blur-sm" />
          </div>
        </div>
        
        <div className="space-y-8">
          <div className="text-center">
            <p className="text-[12px] font-bold text-white tracking-[0.2em] uppercase">
              {isRecording ? "记录中..." : "长按捕获 3 秒素材"}
            </p>
            {isRecording && (
              <div className="mx-auto mt-3 h-1.5 w-48 rounded-full bg-white/20 overflow-hidden">
                <motion.div 
                  className="h-full bg-red-600" 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-center gap-12">
            <RefreshCw size={24} className="text-white/60" />
            <button 
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => !progress && setIsRecording(false)}
              onTouchStart={() => setIsRecording(true)}
              onTouchEnd={() => !progress && setIsRecording(false)}
              className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/40 p-1"
            >
              <div className={`h-full w-full rounded-full bg-white transition-all duration-300 ${isRecording ? "scale-90 rounded-lg bg-red-600 shadow-[0_0_20px_red]" : "scale-100"}`} />
            </button>
            <div className="h-8 w-8 overflow-hidden rounded-lg border-2 border-white/40 bg-white/10" />
          </div>
        </div>
      </div>
      
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-10">
        <motion.div 
          animate={{ y: ["-100%", "100%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="h-[10%] w-full bg-gradient-to-b from-transparent via-white to-transparent"
        />
      </div>
    </motion.div>
  );
}

function VlogSuccessOverlay({ onContinue }: { onContinue: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[110] flex items-center justify-center bg-[#07101d] p-8"
    >
      <div className="text-center">
        <motion.div 
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-white shadow-[0_0_40px_rgba(34,197,94,0.4)]"
        >
          <CheckCircle2 size={40} />
        </motion.div>
        
        <h2 className="text-[28px] font-black italic text-white leading-tight">捕获成功！</h2>
        <p className="mt-4 text-[14px] text-white/50 leading-relaxed max-w-xs mx-auto">
          你拍摄的咖啡店素材已被记录，这一刻将成为你城市 Vlog 的珍贵片段。
        </p>
        
        <div className="mt-12 flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 border border-white/10">
            <div className="h-10 w-10 rounded-lg bg-[url('https://images.unsplash.com/photo-1541167760496-162955ed8a9f?auto=format&fit=crop&q=80&w=200')] bg-cover" />
            <div className="text-left">
              <div className="text-[12px] font-bold">CLIP_0922.mp4</div>
              <div className="text-[10px] text-white/30">高清素材 • 已同步</div>
            </div>
          </div>
          
          <button 
            onClick={onContinue}
            className="w-full rounded-2xl bg-[#6C5CFF] py-4 text-[16px] font-black text-white shadow-xl active:scale-[0.98] transition-all"
          >
            完成打卡并继续
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const IntroOverlay: React.FC<{ onDirectStart: () => void; onCustomize: () => void }> = ({ onDirectStart, onCustomize }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-x-0 bottom-[90px] z-[50] px-5"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 120 }}
        className="w-full max-w-sm mx-auto"
      >
        <div className="rounded-[32px] bg-[#0F172A]/90 border border-white/10 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/50">
                <Compass size={20} />
              </div>
              <h2 className="text-lg font-black text-white italic tracking-tight">当前位置</h2>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-[#FFD166]/10 border border-[#FFD166]/20 px-3 py-1">
               <span className="text-[10px] font-bold text-[#FFD166] uppercase tracking-wider">五道口 · 北京</span>
            </div>
          </div>
          
          <p className="text-[14px] font-medium text-white/70 leading-relaxed mb-6 px-1">
            在迷雾中隐藏着未知的惊喜。踏出你的第一步，解锁神秘故事
          </p>

          <div className="flex flex-col gap-3">
            <button 
              onClick={onDirectStart}
              className="group relative flex w-full items-center justify-center gap-2 rounded-full bg-[#6C5CFF] py-3 text-[15px] font-black text-white shadow-[0_10px_30px_rgba(108,92,255,0.4)] active:scale-[0.98] transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="relative tracking-wider">开始探索吧！</span>
              <Rocket size={16} className="relative fill-white" />
            </button>

            <button 
              onClick={onCustomize}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 py-3 text-[14px] font-bold text-white/60 active:scale-[0.98] transition-all"
            >
              <Target size={14} className="opacity-60" />
              <span>自定义偏好</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RewardOverlay({ onContinue }: { onContinue: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[120] flex items-center justify-center p-8 backdrop-blur-xl bg-black/40"
    >
      <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-[#1A1A2E] to-[#0D0D15] p-6 text-center border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-white/[0.02] pointer-events-none" />
        
        <div className="relative z-10">
          <motion.div 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="mb-6 flex justify-center"
          >
            <div className="relative h-20 w-20 flex items-center justify-center bg-amber-500 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.5)]">
              <Sparkles size={40} className="text-white" />
            </div>
          </motion.div>

          <h2 className="text-2xl font-black text-white italic">隐藏记忆解锁！</h2>
          <p className="mt-2 text-sm text-white/50">你获得了额外的探索奖励</p>

          <div className="my-8 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 border border-white/5">
               <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
                     <Zap size={16} fill="currentColor" />
                  </div>
                  <span className="text-sm font-bold text-white">经验值</span>
               </div>
               <span className="text-lg font-black text-amber-500">+50 XP</span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 border border-white/5 text-left">
               <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-500">
                     <Bike size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">美团单车优惠券</div>
                    <div className="text-[10px] text-white/40">7天畅骑卡</div>
                  </div>
               </div>
               <span className="text-lg font-black text-cyan-500">¥3</span>
            </div>
          </div>

          <button 
            onClick={onContinue}
            className="w-full rounded-2xl bg-white py-4 text-sm font-black text-black active:scale-95 transition-transform"
          >
            查收并前往下一站
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AchievementOverlay({ onContinue }: { onContinue: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[130] flex items-center justify-center p-8 backdrop-blur-2xl bg-black/60"
    >
      <div className="w-full max-w-sm rounded-[40px] bg-[#0F172A] p-8 text-center border-2 border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(108,92,255,0.2),transparent_70%)]" />
        
        <div className="relative z-10">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, rotate: -180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12 }}
            className="mb-8 flex justify-center"
          >
            <div className="h-32 w-32 rounded-full bg-gradient-to-tr from-[#6C5CFF] to-[#A855F7] p-1 shadow-[0_0_50px_rgba(108,92,255,0.6)]">
              <div className="h-full w-full rounded-full bg-[#0F172A] flex items-center justify-center">
                 <Compass size={60} className="text-white" />
              </div>
            </div>
          </motion.div>
          <h3 className="text-[14px] font-black uppercase tracking-[0.3em] text-[#A855F7]">成就解锁</h3>
          <h2 className="mt-2 text-4xl font-black italic text-white">城市开拓者</h2>
          <p className="mt-4 text-sm text-white/50 leading-relaxed">
            你完成了今日所有的探索计划，并用镜头记录下了这个城市鲜为人知的瞬间。
          </p>

          <div className="mt-10 flex flex-col gap-3">
            <button 
              onClick={onContinue}
              className="w-full rounded-2xl bg-white py-4 text-[16px] font-black text-black active:scale-[0.98] transition-all"
            >
              完成探索
            </button>
            <p className="text-[11px] text-white/20 uppercase tracking-widest italic">已录入世界探索名录</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const PreferenceOverlay: React.FC<{ onConfirm: (prefs: UserPreferences) => void; onBack: () => void }> = ({ onConfirm, onBack }) => {
  const [mood, setMood] = useState("happy");
  const [duration, setDuration] = useState("1h");
  const [transport, setTransport] = useState("walk");
  const [special, setSpecial] = useState<string[]>(["outdoor"]);
  const [foodPreference, setFoodPreference] = useState<string[]>(["coffee"]);
  const [intensity, setIntensity] = useState("don't_think");

  const moods = [
    { id: "happy", icon: Smile, label: "开心" },
    { id: "tired", icon: Frown, label: "疲惫" },
    { id: "bored", icon: Meh, label: "无聊" },
    { id: "relax", icon: Wind, label: "想放松" },
    { id: "explore", icon: Search, label: "想探索" },
    { id: "hungry", icon: Utensils, label: "想吃好的" },
  ];

  const durations = [
    { id: "30min", label: "30分钟" },
    { id: "1h", label: "1小时" },
    { id: "2h", label: "2小时" },
    { id: "half_day", label: "半天" },
  ];

  const transports = [
    { id: "walk", icon: Bike, label: "步行" },
    { id: "bus", icon: RefreshCw, label: "公交/地铁" },
  ];

  const specials = [
    { id: "art", icon: Palette, label: "文艺" },
    { id: "outdoor", icon: Mountain, label: "户外" },
    { id: "food", icon: Utensils, label: "美食" },
    { id: "busy", icon: Flame, label: "热闹" },
    { id: "family", icon: Users, label: "亲子" },
    { id: "photo", icon: CameraIcon, label: "拍照" },
    { id: "niche", icon: Gem, label: "小众" },
    { id: "budget", icon: PiggyBank, label: "省钱" },
  ];

  const foods = [
    { id: "light", icon: Wind, label: "清淡" },
    { id: "spicy", icon: Flame, label: "麻辣" },
    { id: "western", icon: Pizza, label: "西式" },
    { id: "coffee", icon: Coffee, label: "甜品咖啡" },
  ];

  const intensities: { id: string; icon: typeof Target; label: string; sub?: string; recommended?: boolean }[] = [
    { id: "relaxed", icon: Target, label: "轻松带路" },
    { id: "normal", icon: Book, label: "正常探索" },
    { id: "don't_think", icon: Wand2, label: "别让我思考", recommended: true },
  ];

  const toggleList = (list: string[], setList: (l: string[]) => void, id: string) => {
    if (list.includes(id)) {
      setList(list.filter(item => item !== id));
    } else {
      setList([...list, id]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex flex-col bg-[#05070A]"
    >
      <div className="flex items-center px-4 py-4 mt-12">
        <button onClick={onBack} className="p-2 text-white/80 active:scale-90 bg-white/5 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 text-center pr-10">
          <h2 className="flex items-center justify-center gap-2 text-xl font-black text-white italic tracking-tight">
             <Sparkles size={20} className="text-[#6C5CFF]" /> 今天想怎么走？ <Sparkles size={20} className="text-[#6C5CFF]" />
          </h2>
          <p className="mt-1 text-[11px] text-white/40 font-medium">系统会结合你的偏好、天气和历史反馈生成路线</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-40 scrollbar-hide">
        <div className="relative mb-6 mt-1 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-4 shadow-xl border border-white/5">
          <img 
            src="https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=600&q=80" 
            alt="北京天际线"
            className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-overlay"
          />
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#6C5CFF]/10 blur-[60px] rounded-full" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] font-bold text-white/80 w-fit">
                <MapPin size={10} /> 五道口 <ChevronDown size={10} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="text-3xl font-black text-white">22°C</div>
                <div className="text-xs font-bold text-white/60">晴</div>
              </div>
              <div className="mt-2 rounded-full bg-[#6C5CFF]/20 border border-[#6C5CFF]/30 px-3 py-0.5 text-[10px] font-bold text-[#A594FF] w-fit">
                适合步行探索
              </div>
            </div>
            <div className="text-right">
              <div className="text-[12px] font-bold text-white mb-1">今天适合户外路线</div>
              <p className="text-[10px] text-white/40 leading-tight max-w-[130px]">
                系统会优先推荐公园、街区、露台餐饮等地点
              </p>
              <div className="mt-3 flex justify-end">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8F5CFF]/20 border border-[#8F5CFF]/30 text-[#8F5CFF]">
                  <Mountain size={18} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <SectionTitle num={1} title="你现在的状态？" />
        <div className="grid grid-cols-6 gap-1.5 mb-6">
          {moods.map((m) => (
            <button
              key={m.id}
              onClick={() => setMood(m.id)}
              className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border transition-all ${
                mood === m.id ? "bg-[#1A1A2E] border-[#6C5CFF] text-[#6C5CFF]" : "bg-white/5 border-transparent text-white/40"
              }`}
            >
              <m.icon size={18} strokeWidth={mood === m.id ? 2.5 : 2} />
              <span className="text-[9px] font-medium whitespace-nowrap">{m.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <SectionTitle num={2} title="这次想走多久？" />
            <div className="grid grid-cols-2 gap-1.5">
              {durations.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDuration(d.id)}
                  className={`py-2 px-1 rounded-xl border text-[9px] font-bold transition-all ${
                    duration === d.id ? "bg-[#1A1A2E] border-[#6C5CFF] text-white shadow-[0_0_15px_rgba(108,92,255,0.2)]" : "bg-white/5 border-transparent text-white/30"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
             <SectionTitle num="" title="交通方式" />
             <div className="flex flex-col gap-1.5">
               {transports.map((t) => (
                 <button
                   key={t.id}
                   onClick={() => setTransport(t.id)}
                   className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-[9px] font-bold transition-all ${
                     transport === t.id ? "bg-[#1A1A2E] border-[#6C5CFF] text-white shadow-[0_0_15px_rgba(108,92,255,0.2)]" : "bg-white/5 border-transparent text-white/30"
                   }`}
                 >
                   <t.icon size={12} />
                   {t.label}
                 </button>
               ))}
               <p className="text-[9px] text-center text-white/20 mt-1">当前仅支持步行与公共交通</p>
             </div>
          </div>
        </div>

        <SectionTitle num={3} title="有没有特别想要？" sub="(可多选)" />
        <div className="flex flex-wrap gap-2 mb-6">
          {specials.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleList(special, setSpecial, s.id)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-[9px] font-bold transition-all ${
                special.includes(s.id) ? "bg-[#1A1A2E] border-[#6C5CFF] text-white shadow-[0_0_15px_rgba(108,92,255,0.2)]" : "bg-white/5 border-transparent text-white/40"
              }`}
            >
              <s.icon size={11} />
              {s.label}
            </button>
          ))}
        </div>

        <SectionTitle num={4} title="如果路上安排吃的，你偏好？" sub="(可选)" />
        <div className="flex flex-wrap gap-2 mb-6">
          {foods.map((f) => (
            <button
              key={f.id}
              onClick={() => toggleList(foodPreference, setFoodPreference, f.id)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-[9px] font-bold transition-all ${
                foodPreference.includes(f.id) ? "bg-[#1A1A2E] border-[#6C5CFF] text-white shadow-[0_0_15px_rgba(108,92,255,0.2)]" : "bg-white/5 border-transparent text-white/40"
              }`}
            >
              <f.icon size={11} />
              {f.label}
            </button>
          ))}
        </div>

        <SectionTitle num={5} title="今天想被安排什么程度？" />
        <div className="grid grid-cols-3 gap-2 mb-6">
          {intensities.map((i) => (
            <button
              key={i.id}
              onClick={() => setIntensity(i.id)}
              className={`relative flex flex-col items-center text-center gap-1 p-1 py-2.5 rounded-xl border transition-all ${
                intensity === i.id ? "bg-[#1A1A2E] border-[#6C5CFF] text-white shadow-[0_0_20px_rgba(108,92,255,0.3)]" : "bg-white/5 border-transparent text-white/30"
              }`}
            >
              {i.recommended && (
                <div className="absolute -top-1.5 -right-0.5 bg-[#6C5CFF] text-white text-[7px] font-black px-1 py-0.5 rounded-md">推荐</div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black">{i.label}</span>
                {i.sub && <span className="text-[8px] opacity-40">{i.sub}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] p-5 bg-gradient-to-t from-[#05070A] via-[#05070A] to-transparent">
        <button 
          onClick={() => onConfirm({ mood, duration, transport, special, foodPreference, intensity })}
          className="group relative flex w-full items-center justify-center gap-3 rounded-full bg-[#6C5CFF] py-3.5 text-[16px] font-black text-white shadow-[0_15px_40px_rgba(108,92,255,0.4)] active:scale-[0.98] transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          <Sparkles size={18} className="fill-white" />
          <span>生成今日剧情</span>
        </button>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-white/20">
          <X size={10} /> 目的地点将在途中逐步解锁
        </div>
      </div>
    </motion.div>
  );
}

function SectionTitle({ num, title, sub }: { num: number | string; title: string, sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {num !== "" && <span className="text-base font-black text-[#6C5CFF]">{num}.</span>}
      <h3 className="text-[13px] font-black text-white tracking-wide">{title}</h3>
      {sub && <span className="text-[10px] text-white/20 font-medium">{sub}</span>}
      {title.includes("程度") && <HelpCircle size={12} className="text-white/20" />}
    </div>
  );
}

function GearConfirmationOverlay({ onConfirm, onBack }: { onConfirm: () => void; onBack: () => void }) {
  const [confirmed, setConfirmed] = useState<string[]>(["phone", "battery"]);
  
  const gearList = [
    { id: "phone", icon: Smartphone, label: "手机", desc: "满电状态" },
    { id: "battery", icon: Battery, label: "充电宝", desc: "以防万一" },
    { id: "umbrella", icon: Umbrella, label: "雨伞", desc: "预防阵雨" },
    { id: "id_card", icon: CreditCard, label: "身份证", desc: "必要证件" },
  ];

  const handleConfirm = () => {
    localStorage.setItem('confirmedGear', JSON.stringify(confirmed));
    onConfirm();
  };

  const toggleGear = (id: string) => {
    if (confirmed.includes(id)) {
      setConfirmed(confirmed.filter(i => i !== id));
    } else {
      setConfirmed([...confirmed, id]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="absolute inset-0 z-[100] flex flex-col bg-[#05070A]"
    >
      <div className="flex items-center px-4 py-4 mt-12">
        <button onClick={onBack} className="p-2 text-white/80 active:scale-90 bg-white/5 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 text-center pr-10">
          <h2 className="flex items-center justify-center gap-2 text-xl font-black text-white italic tracking-tight">
             装备确认 <Rocket size={20} className="text-[#6C5CFF]" />
          </h2>
          <p className="mt-1 text-[11px] text-white/40 font-medium">带上这些，让探索更从容</p>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 overflow-y-auto no-scrollbar">
        <div className="grid grid-cols-1 gap-2.5">
          {gearList.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleGear(item.id)}
              className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                confirmed.includes(item.id) 
                  ? "bg-[#1A1A2E] border-[#6C5CFF] shadow-[0_8px_20px_rgba(108,92,255,0.15)]" 
                  : "bg-white/5 border-white/5"
              }`}
            >
              <div className={`p-2 rounded-xl ${confirmed.includes(item.id) ? "bg-[#6C5CFF] text-white" : "bg-white/5 text-white/20"}`}>
                <item.icon size={20} />
              </div>
              <div className="flex-1 text-left">
                <div className={`text-[14px] font-black ${confirmed.includes(item.id) ? "text-white" : "text-white/20"}`}>{item.label}</div>
                <div className={`text-[10px] ${confirmed.includes(item.id) ? "text-white/40" : "text-white/10"}`}>{item.desc}</div>
              </div>
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                confirmed.includes(item.id) ? "border-[#6C5CFF] bg-[#6C5CFF]" : "border-white/10"
              }`}>
                {confirmed.includes(item.id) && <CheckCircle2 size={12} className="text-white" />}
              </div>
            </button>
          ))}
        </div>
        
        <div className="mt-6 p-4 rounded-2xl bg-[#6C5CFF]/10 border border-[#6C5CFF]/20">
          <div className="flex items-start gap-2.5">
            <Info size={16} className="text-[#6C5CFF] mt-0.5" />
            <div>
              <div className="text-[13px] font-bold text-white">温馨提示</div>
              <p className="mt-1 text-[11px] text-white/40 leading-relaxed">
                部分探索点可能需要手机 NFC 或 4G 网络，请确保网络通畅并开启定位服务。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 pb-10 bg-gradient-to-t from-[#05070A] via-[#05070A] to-transparent">
        <button 
          onClick={handleConfirm}
          className="group relative flex w-full items-center justify-center gap-3 rounded-full bg-[#6C5CFF] py-3.5 text-[16px] font-black text-white shadow-[0_15px_40px_rgba(108,92,255,0.4)] active:scale-[0.98] transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          <span>已备齐，开启探索！</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </motion.div>
  );
}
