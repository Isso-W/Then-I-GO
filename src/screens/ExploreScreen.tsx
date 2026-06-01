import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Zap, Compass, Gift, Navigation, HelpCircle, Clock, RotateCcw, CheckCircle2, ChevronDown, MapPin, ExternalLink, Camera, X, RefreshCw, Bike, Rocket, Target, Layers, ChevronLeft, Smile, Frown, Meh, Wind, Utensils, Search, Palette, Mountain, Coffee, Book, Users, CameraIcon, Gem, PiggyBank, Flame, Pizza, Wand2, Smartphone, Battery, Umbrella, CreditCard, Info, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";
import { BottomNav } from "../components/CommonUI";
import { Map } from "../components/Map";
import { distanceMeters } from "../agents/poiFilter";
import type { LatLng } from "../components/mapProjection";
import { ChatBubble, ChatPanel, type ChatMessage } from "../components/ChatPanel";
import { ScreenType, ExploreStep, UserPreferences, GeneratedRoute, Waypoint, RouteBranch } from "../types";

export function ExploreScreen({
  onNavigate,
  step,
  setStep,
  onPreferenceConfirm,
  onDirectStart,
  onGearConfirm,
  generatedRoute,
  currentPosition,
  onUserDrag,
  onBranchChoice,
  mystery,
  chatMessages,
  chatLoading,
  onChatSend,
}: {
  onNavigate: (s: ScreenType) => void;
  step: ExploreStep;
  setStep: (s: ExploreStep) => void;
  onPreferenceConfirm: (prefs: UserPreferences) => void;
  onDirectStart: () => void;
  onGearConfirm?: () => void;
  generatedRoute: GeneratedRoute | null;
  currentPosition: LatLng;
  onUserDrag?: (p: LatLng) => void;
  onBranchChoice: (index: number) => void;
  mystery?: boolean;
  chatMessages?: ChatMessage[];
  chatLoading?: boolean;
  onChatSend?: (text: string) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);

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

  const isGameStarted = !["intro", "preference_selection", "gear_confirmation"].includes(step);
  const isCapturing = ["checkin_initial", "checkin_hidden", "checkin_next"].includes(step);

  // 接近触发打卡（模拟 LBS）：红点进入激活 waypoint 半径内才允许打卡。
  // 没有路线/目标时不拦截（保留兜底流程）。
  const CHECKIN_RADIUS_M = 30;
  const activeTarget =
    step === "initial" || step === "checkin_initial"
      ? generatedRoute?.waypoints[0]
      : step === "hidden_active" || step === "checkin_hidden"
      ? generatedRoute?.hiddenTask
      : step === "next_objective" || step === "checkin_next"
      ? generatedRoute?.waypoints[1]
      : undefined;
  const distToTarget = activeTarget
    ? distanceMeters(currentPosition, { lat: activeTarget.lat, lng: activeTarget.lng })
    : 0;
  const inRange = !activeTarget || distToTarget <= CHECKIN_RADIUS_M;
  const rangeLabel = activeTarget && !inRange ? `${Math.round(distToTarget)}m` : null;

  return (
    <AppLayout>
      <div className="absolute inset-0 z-0 overflow-hidden bg-[#07101d]">
        <Map route={generatedRoute} currentPosition={currentPosition} onUserDrag={onUserDrag} step={step} />
      </div>
      <FogLayer />
      {(step === "intro" || (isGameStarted && !isCapturing)) && <ExploreHeader />}
      {isGameStarted && !isCapturing && <ProgressPanel step={step} route={generatedRoute} />}
      {isGameStarted && !isCapturing && <DirectionPanel route={generatedRoute} step={step} rangeLabel={rangeLabel} />}
      
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
        {step === "gear_confirmation" && (
          <GearConfirmationOverlay onConfirm={() => onGearConfirm?.()} onBack={() => setStep("preference_selection")} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === "hidden_found" && (
          <HiddenTaskAlert hiddenTask={generatedRoute?.hiddenTask} onAccept={startHiddenTask} mystery={mystery} />
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
              inRange={inRange}
              hasTarget={!!activeTarget}
              rangeLabel={rangeLabel}
              mystery={mystery}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {isCapturing && (
          <CameraInterface
            onCapture={() => {
              if (inRange) {
                // 到达范围内 = 打卡：推进任务流程
                if (step === "checkin_initial") handleInitialCheckin();
                if (step === "checkin_hidden") handleHiddenCheckin();
                if (step === "checkin_next") setStep("achievement_unlock");
              } else {
                // 半路 = 仅记录：关相机回原步骤，素材保留但不推进
                if (step === "checkin_initial") setStep("initial");
                if (step === "checkin_hidden") setStep("hidden_active");
                if (step === "checkin_next") setStep("next_objective");
              }
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
          <BranchChoiceOverlay branch={generatedRoute?.branch} onPick={onBranchChoice} mystery={mystery} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === "achievement_unlock" && (
          <AchievementOverlay onContinue={() => setStep("intro")} />
        )}
      </AnimatePresence>

      {isGameStarted && !isCapturing && !chatOpen && (
        <ChatBubble onClick={() => setChatOpen(true)} hasRoute={!!generatedRoute} />
      )}
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages ?? []}
        onSend={onChatSend ?? (() => {})}
        loading={chatLoading ?? false}
      />

      <BottomNav active="explore" onNavigate={onNavigate} />
    </AppLayout>
  );
}

function FogLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/* 上方浓雾 */}
      <div className="absolute -left-10 -top-10 right-0 h-[35%] bg-gradient-to-b from-[#07101d] via-[#07101d]/80 to-transparent" />
      {/* 下方浓雾 */}
      <div className="absolute -left-10 -bottom-10 right-0 h-[30%] bg-gradient-to-t from-[#07101d] via-[#07101d]/70 to-transparent" />
      {/* 左右边缘雾 */}
      <div className="absolute left-0 top-0 bottom-0 w-[20%] bg-gradient-to-r from-[#07101d]/80 to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-[20%] bg-gradient-to-l from-[#07101d]/80 to-transparent" />
      {/* 漂浮迷雾 */}
      <motion.div
        animate={{ x: [0, 30, 0], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute -left-20 top-[20%] h-56 w-96 rounded-full bg-slate-400/15 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -25, 0], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        className="absolute -right-16 top-[35%] h-48 w-80 rounded-full bg-indigo-400/10 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, -15, 0], opacity: [0.1, 0.25, 0.1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        className="absolute left-[15%] bottom-[25%] h-52 w-96 rounded-full bg-purple-300/12 blur-3xl"
      />
      {/* 中央透光区域 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,transparent_0%,transparent_18%,rgba(7,16,29,0.3)_40%,rgba(7,16,29,0.75)_100%)]" />
    </div>
  );
}

function ExploreHeader() {
  return (
    <header className="absolute left-5 right-5 top-[56px] z-30 flex items-start justify-between">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="flex items-center gap-2 text-[24px] font-bold leading-none text-white drop-shadow-lg">
          那我走 <Sparkles size={14} className="text-[#FFD166]" />
        </h1>
        <p className="mt-1.5 text-[12px] text-[#D7D7E8]/80 font-medium">你只管走出门，剩下的由系统决定</p>
      </motion.div>
      <button className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1.5 px-3 text-[11px] text-white backdrop-blur-md active:scale-95 transition-all">
        <Clock size={12} />任务日志
      </button>
    </header>
  );
}

function ProgressPanel({ step, route }: { step: ExploreStep; route: GeneratedRoute | null }) {
  const total = route ? route.waypoints.length + (route.hiddenTask ? 1 : 0) : 5;
  const current = step === "initial" || step === "checkin_initial" ? 1
    : step === "hidden_active" || step === "checkin_hidden" || step === "hidden_found" ? 2
    : step === "next_objective" || step === "checkin_next" ? Math.min(3, total)
    : step === "achievement_unlock" ? total : 1;
  const pct = Math.round((current / total) * 100);

  return (
    <Glass className="absolute left-4 top-[120px] z-20 w-[140px] p-3 text-white">
      <div className="text-[10px] font-bold text-white/50">当前进度</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[18px] font-black">{current}/{total}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div className="h-full rounded-full bg-[#6C5CFF]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-[9px] font-bold text-white/60">
        <span className="flex items-center gap-0.5"><Flame size={9} className="text-orange-400" />240</span>
        <span className="flex items-center gap-0.5"><Zap size={9} className="text-[#FFD166]" />80分</span>
        <span className="flex items-center gap-0.5"><MapPin size={9} className="text-[#A98BFF]" />4.5</span>
      </div>
      <div className="mt-2 border-t border-white/5 pt-2">
        <div className="text-[9px] font-bold text-white/40">今日目标</div>
        <div className="mt-1 space-y-1 text-[9px] text-white/50">
          <div className="flex items-center gap-1"><CheckCircle2 size={8} className="text-emerald-400" />完成首站打卡</div>
          <div className="flex items-center gap-1"><Target size={8} className="text-white/30" />触发隐藏任务</div>
        </div>
      </div>
    </Glass>
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

function DirectionPanel({ route, step, rangeLabel }: { route: GeneratedRoute | null; step: ExploreStep; rangeLabel: string | null }) {
  const wp = step === "initial" || step === "checkin_initial" ? route?.waypoints[0]
    : step === "hidden_active" || step === "checkin_hidden" ? route?.hiddenTask
    : route?.waypoints[1];

  return (
    <Glass className="absolute right-4 top-[120px] z-20 w-[130px] p-3 text-white">
      <div className="text-[9px] font-bold text-[#A98BFF]">下一目标</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Navigation size={12} className="text-[#6C5CFF] rotate-45 shrink-0" />
        <span className="text-[12px] font-black leading-tight">{wp?.distanceText ?? "向前走"}</span>
      </div>
      <div className="mt-1 text-[9px] text-white/40">{rangeLabel ? `距目标 ${rangeLabel}` : "预计 2 分钟到达"}</div>

      <div className="mt-3 border-t border-white/5 pt-2 space-y-1.5 text-[8px] text-white/40">
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#6C5CFF]" />打卡点</div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 border border-[#FFD166] bg-transparent" />下一目标</div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />已完成</div>
      </div>
    </Glass>
  );
}

function TaskCard({ step, onComplete, onCheckIn, generatedRoute, inRange, hasTarget, rangeLabel, mystery }: {
  step: ExploreStep;
  onComplete: () => void;
  onCheckIn: () => void;
  generatedRoute: GeneratedRoute | null;
  inRange: boolean;
  hasTarget: boolean;
  rangeLabel: string | null;
  mystery?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isHiddenActive = step === "hidden_active" || step === "checkin_hidden";
  const isInitial = step === "initial" || step === "checkin_initial";
  const isNext = step === "next_objective" || step === "checkin_next";

  const wp0 = generatedRoute?.waypoints[0];
  const wp1 = generatedRoute?.waypoints[1];
  const hidden = generatedRoute?.hiddenTask;

  const getTaskContent = () => {
    if (isInitial) return {
      title: wp0?.name ?? "前往第一站",
      desc: wp0?.description ?? "目的地在地下，那里夏凉冬不凉",
      task: wp0?.task ?? "前方直走100m",
      reward: wp0?.reward ?? "+10 XP",
      emoji: wp0?.emoji ?? "📍",
      color: "#6C5CFF",
      distanceText: wp0?.distanceText ?? "向前走",
      isChallenge: false,
    };
    if (isHiddenActive) return {
      title: hidden?.name ? `秘密：${hidden.name}` : "隐藏坐标",
      desc: hidden?.description ?? "附近藏着一个未公开的坐标，去发现它。",
      task: hidden?.task ?? "开启特殊的视频打卡",
      reward: hidden?.reward ?? "+50 XP",
      emoji: hidden?.emoji ?? "✨",
      color: "#F59E0B",
      distanceText: hidden?.distanceText ?? "向前走",
      isChallenge: true,
    };
    if (isNext) return {
      title: wp1?.name ?? "前往下一站",
      desc: wp1?.description ?? "那里是个即便你发呆四个小时，也会被认为'思考人生'的合法场所",
      task: wp1?.task ?? "左转直走",
      reward: wp1?.reward ?? "+20 XP",
      emoji: wp1?.emoji ?? "📍",
      color: "#0066FF",
      distanceText: wp1?.distanceText ?? "向前走",
      isChallenge: false,
    };
    return { title: "任务完成", desc: "", task: "点击查看后续", reward: "+0", emoji: "🎉", color: "#10B981", distanceText: "", isChallenge: false };
  };

  const content = getTaskContent();
  const displayTitle = mystery && hasTarget && !inRange ? "？？？" : content.title;

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheckIn();
  };

  return (
    <Glass
      onClick={() => setIsExpanded(!isExpanded)}
      className="relative w-full z-40 text-white overflow-hidden cursor-pointer rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} className="text-white/40">
            <ChevronDown size={14} />
          </motion.div>
          <h2 className="text-[13px] font-black text-white/80">
            {isInitial ? "下一步任务" : isHiddenActive ? "隐藏任务" : isNext ? "下一步任务" : "探索中"}
          </h2>
          {hasTarget && !inRange && rangeLabel && (
            <span className="text-[10px] text-white/30">距离 {rangeLabel} 的路程</span>
          )}
          {hasTarget && inRange && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">✓ 到了</span>
          )}
        </div>
        <span className="text-[11px] font-mono font-bold text-white/40">{isInitial ? "02:00" : isNext ? "12:00" : "∞"}</span>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#6C5CFF]/15 text-[22px]">
                  <Navigation size={20} className="text-[#A98BFF] rotate-45" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-black text-white">{content.distanceText}</div>
                  <p className="mt-0.5 text-[11px] text-white/40 line-clamp-2">{content.desc}</p>
                </div>
                {content.isChallenge && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-black text-amber-400">小挑战</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded-full bg-[#6C5CFF]/15 px-2.5 py-1 text-[11px] font-bold text-[#A98BFF]">
                    <Zap size={10} className="fill-[#A98BFF]" />+10
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-[#FFD166]/15 px-2.5 py-1 text-[11px] font-bold text-[#FFD166]">
                    <Gift size={10} />+5
                  </span>
                </div>
                <button
                  onClick={handleAction}
                  className="rounded-full bg-[#6C5CFF] px-4 py-2 text-[12px] font-bold text-white shadow-lg active:scale-95 transition-transform"
                >
                  {inRange ? "打卡" : "记录"}
                </button>
              </div>

              <p className="text-center text-[10px] text-white/25">保持好奇心的你真棒！</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Glass>
  );
}

function HiddenTaskAlert({ hiddenTask, onAccept, mystery }: { hiddenTask?: Waypoint; onAccept: () => void; mystery?: boolean }) {
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
               <span className="text-[14px] font-bold">{mystery ? "？？？" : (hiddenTask?.name ?? "隐藏坐标")}</span>
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

function BranchChoiceOverlay({ branch, onPick, mystery }: { branch?: RouteBranch; onPick: (index: number) => void; mystery?: boolean }) {
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
            className="flex-1 rounded-3xl border border-white/10 bg-[var(--bg-card)]/90 p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,.45)] active:scale-[0.97] transition-transform"
          >
            <div className="text-3xl">{opt.emoji}</div>
            <div className="mt-2 text-[15px] font-bold text-white">{mystery ? "？？？" : opt.name}</div>
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState(false);

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setHasCamera(true);
      })
      .catch(() => setHasCamera(false));
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

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
      {hasCamera ? (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541167760496-162955ed8a9f?auto=format&fit=crop&q=80&w=1200')] bg-cover bg-center opacity-80" />
      )}
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
  const [collapsed, setCollapsed] = useState(false);
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
        <div className="rounded-[32px] border p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}>
          <button onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                <Compass size={20} />
              </div>
              <h2 className="text-lg font-black italic tracking-tight" style={{ color: "var(--text-primary)" }}>当前位置</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-[#FFD166]/10 border border-[#FFD166]/20 px-3 py-1">
                 <span className="text-[10px] font-bold text-[#FFD166] uppercase tracking-wider">五道口 · 北京</span>
              </div>
              <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
              </motion.div>
            </div>
          </button>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <p className="text-[14px] font-medium leading-relaxed mb-6 mt-4 px-1" style={{ color: "var(--text-muted)" }}>
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
                    className="w-full flex items-center justify-center gap-2 rounded-full border py-3 text-[14px] font-bold active:scale-[0.98] transition-all"
                    style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}
                  >
                    <Target size={14} className="opacity-60" />
                    <span>自定义偏好</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
      <div className="w-full max-w-sm rounded-[40px] bg-[var(--bg-card)] p-8 text-center border-2 border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(108,92,255,0.2),transparent_70%)]" />
        
        <div className="relative z-10">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, rotate: -180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12 }}
            className="mb-8 flex justify-center"
          >
            <div className="h-32 w-32 rounded-full bg-gradient-to-tr from-[#6C5CFF] to-[#A855F7] p-1 shadow-[0_0_50px_rgba(108,92,255,0.6)]">
              <div className="h-full w-full rounded-full bg-[var(--bg-card)] flex items-center justify-center">
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
  const [companion, setCompanion] = useState("solo");
  const [freeText, setFreeText] = useState("");

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
    { id: "don't_think", icon: Wand2, label: "别让我思考", sub: "隐藏下一站·直接带路", recommended: true },
    { id: "normal", icon: Book, label: "正常探索", sub: "显示下一站·你来选" },
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
      className="absolute inset-0 z-[100] flex flex-col bg-[var(--bg-base)]"
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
                mood === m.id ? "bg-[var(--bg-card)] border-[#6C5CFF] text-[#6C5CFF]" : "bg-white/5 border-transparent text-white/40"
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
                    duration === d.id ? "bg-[var(--bg-card)] border-[#6C5CFF] text-white shadow-[0_0_15px_rgba(108,92,255,0.2)]" : "bg-white/5 border-transparent text-white/30"
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
                     transport === t.id ? "bg-[var(--bg-card)] border-[#6C5CFF] text-white shadow-[0_0_15px_rgba(108,92,255,0.2)]" : "bg-white/5 border-transparent text-white/30"
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
                special.includes(s.id) ? "bg-[var(--bg-card)] border-[#6C5CFF] text-white shadow-[0_0_15px_rgba(108,92,255,0.2)]" : "bg-white/5 border-transparent text-white/40"
              }`}
            >
              <s.icon size={11} />
              {s.label}
            </button>
          ))}
        </div>

        <SectionTitle num="" title="同行人物" sub="(可选)" />
        <div className="flex flex-wrap gap-2 mb-6">
          {([
            { id: "solo", icon: Users, label: "独自" },
            { id: "couple", icon: Users, label: "情侣" },
            { id: "friends", icon: Users, label: "朋友" },
            { id: "family", icon: Users, label: "家庭" },
          ] as const).map((c) => (
            <button
              key={c.id}
              onClick={() => setCompanion(c.id)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-[9px] font-bold transition-all ${
                companion === c.id ? "bg-[var(--bg-card)] border-[#6C5CFF] text-white shadow-[0_0_15px_rgba(108,92,255,0.2)]" : "bg-white/5 border-transparent text-white/40"
              }`}
            >
              <c.icon size={11} />
              {c.label}
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
                foodPreference.includes(f.id) ? "bg-[var(--bg-card)] border-[#6C5CFF] text-white shadow-[0_0_15px_rgba(108,92,255,0.2)]" : "bg-white/5 border-transparent text-white/40"
              }`}
            >
              <f.icon size={11} />
              {f.label}
            </button>
          ))}
        </div>

        <SectionTitle num="" title="还有想说的？" sub="(可选)" />
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="比如：今天想吃火锅、想看日落、想找安静的地方发呆…"
          rows={2}
          className="mb-6 w-full resize-none rounded-xl border px-3 py-2.5 text-[12px] font-medium placeholder:text-white/20 focus:outline-none focus:border-[#6C5CFF]"
          style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
        />

        <SectionTitle
          num={5}
          title="今天想被安排什么程度？"
          help={
            <div className="space-y-1.5">
              <div><span className="font-bold text-white">别让我思考</span>：隐藏下一站位置，直接带你走</div>
              <div><span className="font-bold text-white">正常探索</span>：显示下一站位置，岔路你来选</div>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-2 mb-6">
          {intensities.map((i) => (
            <button
              key={i.id}
              onClick={() => setIntensity(i.id)}
              className={`relative flex flex-col items-center text-center gap-1 p-1 py-2.5 rounded-xl border transition-all ${
                intensity === i.id ? "bg-[var(--bg-card)] border-[#6C5CFF] text-white shadow-[0_0_20px_rgba(108,92,255,0.3)]" : "bg-white/5 border-transparent text-white/30"
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
          onClick={() => onConfirm({ mood, duration, transport, special, foodPreference, intensity, companion, freeText: freeText.trim() || undefined })}
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

function SectionTitle({ num, title, sub, help }: { num: number | string; title: string, sub?: string, help?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {num !== "" && <span className="text-base font-black text-[#6C5CFF]">{num}.</span>}
      <h3 className="text-[13px] font-black text-white tracking-wide">{title}</h3>
      {sub && <span className="text-[10px] text-white/20 font-medium">{sub}</span>}
      {help && (
        <span className="group relative inline-flex">
          <HelpCircle size={12} className="text-white/30 hover:text-white/70 cursor-help transition-colors" />
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[var(--bg-card)] p-3 text-left text-[11px] leading-relaxed text-white/70 opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.55)] transition-opacity duration-150 group-hover:opacity-100">
            {help}
          </span>
        </span>
      )}
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
      className="absolute inset-0 z-[100] flex flex-col bg-[var(--bg-base)]"
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
                  ? "bg-[var(--bg-card)] border-[#6C5CFF] shadow-[0_8px_20px_rgba(108,92,255,0.15)]" 
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
