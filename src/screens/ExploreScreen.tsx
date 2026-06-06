import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Zap, BookOpen, Compass, Gift, Navigation, HelpCircle, RotateCcw, CheckCircle2, ChevronDown, MapPin, ExternalLink, Camera, X, RefreshCw, Bike, Rocket, Target, Layers, ChevronLeft, Smile, Frown, Meh, Wind, Utensils, Search, Palette, Mountain, Coffee, Book, Users, CameraIcon, Gem, PiggyBank, Flame, Pizza, Wand2, Smartphone, Battery, Umbrella, CreditCard, Info, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Glass, AppLayout } from "../components/Layout";
import { BottomNav } from "../components/CommonUI";
import { Map } from "../components/Map";
import { distanceMeters } from "../agents/poiFilter";
import type { LatLng } from "../components/mapProjection";
import { ChatBubble, ChatPanel, type ChatMessage } from "../components/ChatPanel";
import { TripFeedbackOverlay } from "../components/TripFeedbackOverlay";
import { ScreenType, ExploreStep, UserPreferences, GeneratedRoute, Waypoint } from "../types";
import { useWeather, weatherEmoji, weatherAdvice } from "../lib/useWeather";
import { buildNavSteps, type NavStep } from "../lib/turnByTurn";
import { buildGraph, routePolyline, type Street } from "../lib/roadGraph";
import streetNetwork from "../../scripts/data/street-network.json";
import type { BBox } from "../components/mapProjection";
import { getCategoryImage } from "../lib/categoryImages";

const NAV_GRAPH = buildGraph((streetNetwork as { streets: Street[] }).streets);

export function ExploreScreen({
  onNavigate,
  step,
  setStep,
  onPreferenceConfirm,
  onDirectStart,
  onGearConfirm,
  weatherCode,
  generatedRoute,
  currentPosition,
  onUserDrag,
  mystery,
  chatMessages,
  chatLoading,
  onChatSend,
  showFeedback,
  onAchievementContinue,
  onFeedbackReact,
  onFeedbackDismiss,
  waypointIndex = 0,
  onAdvanceWaypoint,
  onCheckinPhoto,
}: {
  onNavigate: (s: ScreenType) => void;
  step: ExploreStep;
  setStep: (s: ExploreStep) => void;
  onPreferenceConfirm: (prefs: UserPreferences) => void;
  onDirectStart: () => void;
  onGearConfirm?: () => void;
  weatherCode?: string;
  generatedRoute: GeneratedRoute | null;
  currentPosition: LatLng;
  onUserDrag?: (p: LatLng) => void;
  mystery?: boolean;
  chatMessages?: ChatMessage[];
  chatLoading?: boolean;
  onChatSend?: (text: string) => void;
  showFeedback?: boolean;
  onAchievementContinue?: () => void;
  onFeedbackReact?: (emoji: string) => void;
  onFeedbackDismiss?: () => void;
  waypointIndex?: number;
  onAdvanceWaypoint?: () => void;
  onCheckinPhoto?: (stopIndex: number, dataUrl: string) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);

  const prevPosRef = useRef<LatLng>(currentPosition);
  const headingRef = useRef<number>(0);
  useEffect(() => {
    const prev = prevPosRef.current;
    const dLat = currentPosition.lat - prev.lat;
    const dLng = currentPosition.lng - prev.lng;
    const moved = Math.hypot(dLat * 111320, dLng * 111320 * Math.cos(currentPosition.lat * Math.PI / 180));
    if (moved > 2) {
      headingRef.current = computeBearing(prev, currentPosition);
      prevPosRef.current = currentPosition;
    }
  }, [currentPosition]);

  const handleInitialComplete = () => {
    setStep("checkin_initial");
  };

  const handleInitialCheckin = () => {
    onAdvanceWaypoint?.();
  };

  const startHiddenTask = () => {
    setStep("hidden_active");
  };

  const handleHiddenCheckin = () => {
    setStep("reward_hidden");
  };

  const isGameStarted = !["intro", "preference_selection"].includes(step);
  const isCapturing = ["checkin_initial", "checkin_hidden", "checkin_next"].includes(step);

  // 接近触发打卡（模拟 LBS）：红点进入激活 waypoint 半径内才允许打卡。
  // 没有路线/目标时不拦截（保留兜底流程）。
  const CHECKIN_RADIUS_M = 30;
  const activeTarget =
    step === "initial" || step === "checkin_initial"
      ? generatedRoute?.waypoints[waypointIndex]
      : step === "hidden_active" || step === "checkin_hidden"
      ? generatedRoute?.hiddenTask
      : step === "next_objective" || step === "checkin_next"
      ? generatedRoute?.waypoints[waypointIndex]
      : undefined;
  const distToTarget = activeTarget
    ? distanceMeters(currentPosition, { lat: activeTarget.lat, lng: activeTarget.lng })
    : 0;
  const inRange = !activeTarget || distToTarget <= CHECKIN_RADIUS_M;
  const rangeLabel = activeTarget && !inRange ? `${Math.round(distToTarget)}m` : null;

  const navSteps = React.useMemo(() => {
    if (!activeTarget) return [];
    const poly = routePolyline([currentPosition, { lat: activeTarget.lat, lng: activeTarget.lng }], NAV_GRAPH);
    return buildNavSteps(poly);
  }, [currentPosition, activeTarget]);

  return (
    <AppLayout>
      <div className="absolute inset-0 z-0 overflow-hidden" style={{ backgroundColor: "var(--map-bg)" }}>
        <Map route={generatedRoute} currentPosition={currentPosition} onUserDrag={onUserDrag} step={step} waypointIndex={waypointIndex} />
      </div>
      <FogLayer />
      {(step === "intro" || (isGameStarted && !isCapturing)) && <ExploreHeader />}
      {isGameStarted && !isCapturing && <ProgressPanel step={step} />}
      {isGameStarted && !isCapturing && <DirectionPanel distToTarget={distToTarget} inRange={inRange} navSteps={navSteps} />}
      {isGameStarted && !isCapturing && <FloatingActions onAction={(a) => a === 'event' && onNavigate('event')} />}
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
          <GearConfirmationOverlay onConfirm={() => onGearConfirm?.()} onBack={() => setStep("intro")} weatherCode={weatherCode} generatedRoute={generatedRoute} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === "hidden_found" && (
          <HiddenTaskAlert hiddenTask={generatedRoute?.hiddenTask} onAccept={startHiddenTask} mystery={mystery} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGameStarted && !isCapturing && (
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
              waypointIndex={waypointIndex}
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
            onCapture={(photoDataUrl) => {
              if (photoDataUrl && onCheckinPhoto && generatedRoute) {
                const wpCount = generatedRoute.waypoints.length;
                if (step === "checkin_hidden") {
                  onCheckinPhoto(wpCount, photoDataUrl);
                } else {
                  onCheckinPhoto(waypointIndex, photoDataUrl);
                }
              }
              if (inRange) {
                if (step === "checkin_initial") handleInitialCheckin();
                if (step === "checkin_hidden") handleHiddenCheckin();
                if (step === "checkin_next") onAdvanceWaypoint?.();
              } else {
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
            name={generatedRoute?.hiddenTask?.name}
            reward={generatedRoute?.hiddenTask?.reward}
            emoji={generatedRoute?.hiddenTask?.emoji}
            onContinue={() => setStep("achievement_unlock")}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === "achievement_unlock" && !showFeedback && (
          <AchievementOverlay onContinue={onAchievementContinue ?? (() => setStep("intro"))} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFeedback && (
          <TripFeedbackOverlay
            onReact={onFeedbackReact ?? (() => {})}
            onDismiss={onFeedbackDismiss ?? (() => {})}
          />
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
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 52% 58%, transparent 0%, transparent 24%, var(--fog-color) 100%)` }} />
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
        <h1 className="flex items-center gap-2 text-[24px] font-bold leading-none drop-shadow-lg" style={{ color: "var(--text-primary)" }}>
          那我走 <Sparkles size={14} className="text-[var(--accent-gold)]" />
        </h1>
        <p className="mt-1.5 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>你只管出门，剩下由系统决定</p>
      </motion.div>
    </header>
  );
}

function liveDistLabel(meters: number): string {
  if (meters < 1) return "已到达";
  if (meters < 1000) return `${Math.round(meters)}米`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function liveEta(meters: number): string {
  const min = Math.ceil(meters / 80);
  return min <= 0 ? "已到达" : `预计 ${min} 分钟到达`;
}

function relativeTurnAngle(heading: number, targetBearing: number): number {
  let diff = targetBearing - heading;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

function computeBearing(from: LatLng, to: { lat: number; lng: number }): number {
  return Math.atan2(to.lng - from.lng, to.lat - from.lat) * (180 / Math.PI);
}

function DirectionPanel({ distToTarget, inRange, navSteps }: {
  distToTarget: number; inRange: boolean; navSteps: NavStep[];
}) {
  const nextTurn = navSteps.find((s) => s.instruction.includes("转") || s.instruction.includes("掉头"));
  const distToTurn = nextTurn
    ? navSteps.slice(0, navSteps.indexOf(nextTurn)).reduce((sum, s) => sum + s.distanceM, 0)
    : distToTarget;

  let turnIcon: React.ReactNode = <Navigation size={28} className="text-[#A98BFF]" />;
  let turnLabel = "直行";
  if (nextTurn) {
    turnLabel = nextTurn.instruction;
    if (turnLabel.includes("右")) turnIcon = <ChevronRight size={28} />;
    else if (turnLabel.includes("左")) turnIcon = <ChevronLeft size={28} />;
    else if (turnLabel.includes("掉头")) turnIcon = <RotateCcw size={24} />;
  }

  return (
    <Glass className="absolute right-4 top-[56px] z-20 w-[140px] p-3">
      {inRange ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <span className="text-[14px] font-black text-emerald-400">已到达</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6C5CFF]/20 text-[#A98BFF]">
              {turnIcon}
            </div>
            <div>
              <div className="text-[14px] font-black" style={{ color: "var(--text-primary)" }}>
                {nextTurn ? `${liveDistLabel(distToTurn)}后${turnLabel}` : "直行"}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
            总距离 {liveDistLabel(distToTarget)} · {liveEta(distToTarget)}
          </div>
        </>
      )}
      <div className="mt-3 border-t pt-2 space-y-1.5 text-[8px]" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#6C5CFF]" />打卡点</div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 border border-[#FFD166] bg-transparent" />下一目标</div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />已完成</div>
      </div>
    </Glass>
  );
}

function ProgressPanel({ step }: { step: ExploreStep }) {
  return (
    <Glass className="absolute left-4 top-[120px] z-20 w-[115px] p-2.5">
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
          <Zap size={12} className="fill-[var(--accent-gold)] text-[var(--accent-gold)]" />
          <span>体力</span>
        </div>
        <span className="font-bold text-[var(--accent-gold)]">85</span>
      </div>
    </Glass>
  );
}

function FloatingActions({ onAction }: { onAction: (a: string) => void }) {
  return (
    <div className="absolute left-5 bottom-[115px] z-30 flex flex-col gap-2">
      <button className="flex h-12 w-12 flex-col items-center justify-center rounded-full border shadow-lg backdrop-blur-md active:scale-90 overflow-hidden" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-card)", color: "var(--text-muted)" }}>
        <Compass size={18} className="text-[#A98BFF]" />
        <span className="mt-0.5 text-[8px] opacity-70">重置</span>
      </button>
      <button
        onClick={() => onAction('event')}
        className="relative flex h-12 w-12 flex-col items-center justify-center rounded-full border shadow-lg backdrop-blur-md active:scale-95"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-card)", color: "var(--text-muted)" }}
      >
        <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF4D64] text-[9px] font-bold text-white">2</span>
        <Gift size={20} className="fill-[var(--accent-gold)] text-[var(--accent-gold)]" />
        <span className="mt-0.5 text-[8px] opacity-70">事件</span>
      </button>
    </div>
  );
}


function TaskCard({ step, onComplete, onCheckIn, generatedRoute, waypointIndex = 0, inRange, hasTarget, rangeLabel, mystery }: {
  step: ExploreStep;
  onComplete: () => void;
  onCheckIn: () => void;
  generatedRoute: GeneratedRoute | null;
  waypointIndex?: number;
  inRange: boolean;
  hasTarget: boolean;
  rangeLabel: string | null;
  mystery?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isHiddenActive = step === "hidden_active" || step === "checkin_hidden";
  const isInitial = step === "initial" || step === "checkin_initial";
  const isNext = step === "next_objective" || step === "checkin_next";

  const currentWp = generatedRoute?.waypoints[waypointIndex];
  const hidden = generatedRoute?.hiddenTask;
  const totalStops = generatedRoute?.waypoints.length ?? 0;
  const stationLabel = isInitial ? "首站探索" : isNext ? `第${waypointIndex + 1}/${totalStops}站` : isHiddenActive ? "触发：隐藏任务" : "探索中";

  const getTaskContent = () => {
    if (isInitial) return {
      title: currentWp?.name ?? "前往第一站",
      desc: currentWp?.task ?? "前方直走100m|预计6min到达",
      detail: currentWp?.description ?? "目的地在地下，那里夏凉冬不凉",
      reward: currentWp?.reward ?? "¥15探索优惠券",
      color: "#6C5CFF",
    };
    if (isHiddenActive) return {
      title: hidden?.name ? `秘密：${hidden.name}` : "隐藏坐标",
      desc: hidden?.task ?? "开启特殊的视频打卡",
      detail: hidden?.description ?? "附近藏着一个未公开的坐标，去发现它，完成一次特别打卡。",
      reward: hidden?.reward ?? "¥50隐藏限定优惠券",
      color: "#F59E0B",
    };
    if (isNext) return {
      title: currentWp?.name ?? "前往下一站",
      desc: currentWp?.task ?? "继续前进",
      detail: currentWp?.description ?? "新的目的地在等着你",
      reward: currentWp?.reward ?? "¥20探索优惠券",
      color: "#0066FF",
    };
    return { title: "任务完成", desc: "点击查看后续", detail: "", reward: "+0", color: "#10B981" };
  };

  const content = getTaskContent();
  // 别让我思考：到达（inRange）前藏起目的地名字和奖励，到了才揭晓
  const hideMystery = mystery && hasTarget && !inRange;
  const displayTitle = hideMystery ? "？？？" : content.title;
  const displayReward = hideMystery ? "到达后揭晓" : content.reward;

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheckIn(); // 随时可打卡/记录；接近只做提醒，不拦截
  };

  return (
    <Glass
      onClick={() => setIsExpanded(!isExpanded)}
      className="relative w-full z-40 p-6 overflow-hidden transition-all duration-300 cursor-pointer rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-[var(--accent-gold)]" />
          <h2 className="text-[16px] font-bold uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
            {stationLabel}
          </h2>
          {hasTarget && (
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                inRange ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : ""
              }`}
              style={!inRange ? { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" } : undefined}
            >
              {inRange ? "✓ 到了 · 可打卡" : `距目标 ${rangeLabel}`}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          className="opacity-40"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronDown size={16} />
        </motion.div>
      </div>

      <div className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(108,92,255,0.15)", color: "#A98BFF" }}>
            <Navigation size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold line-clamp-2" style={{ color: "var(--text-primary)" }}>{displayTitle}</div>
            <p className="text-[11px] line-clamp-2" style={{ color: "var(--text-muted)" }}>{content.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg w-fit" style={{ backgroundColor: "var(--bg-input)" }}>
          <Zap size={12} className="fill-[var(--accent-gold)] text-[var(--accent-gold)]" />
          <span className="text-[12px] font-bold text-[var(--accent-gold)]">{displayReward}</span>
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
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {content.detail}
              </p>

              <button
                onClick={handleAction}
                className="w-full rounded-xl py-3 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(108,92,255,0.4)] active:scale-[0.98] transition-transform bg-[#6C5CFF]"
              >
                开启打卡 / 记录
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Glass>
  );
}

function HiddenTaskImage({ category, emoji }: { category?: string; emoji?: string }) {
  const [failed, setFailed] = useState(false);
  const src = getCategoryImage(category);
  if (failed || !category) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-amber-500/10">
        <span className="text-6xl drop-shadow-lg">{emoji || "🗺️"}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-full w-full rounded-2xl object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function HiddenTaskAlert({ hiddenTask, onAccept, mystery }: { hiddenTask?: Waypoint; onAccept: () => void; mystery?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-end justify-center pb-6 px-4 backdrop-blur-md bg-black/30"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-sm overflow-hidden rounded-[28px] shadow-[0_-4px_40px_rgba(0,0,0,0.3)]"
        style={{ backgroundColor: "var(--bg-card)" }}
      >
        {/* 顶部标签 */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 shadow-lg">
          <Sparkles size={13} className="text-black" />
          <span className="text-[11px] font-black text-black tracking-wide">发现 · 隐藏任务</span>
        </div>

        {/* 品类插图 */}
        <div className="h-[220px] w-full bg-amber-500/5">
          <HiddenTaskImage category={hiddenTask?.category} emoji={hiddenTask?.emoji} />
        </div>

        {/* 内容 */}
        <div className="space-y-3 p-5">
          <div>
            <h2 className="text-[22px] font-black text-[var(--text-primary)] leading-tight">
              {mystery ? "？？？" : (hiddenTask?.name ?? "隐藏坐标")}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
              {hiddenTask?.description ?? "附近藏着一个未公开的坐标，藏着这个街区的某个秘密瞬间。"}
            </p>
          </div>

          {/* 距离 + 奖励 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5">
              <MapPin size={13} className="text-amber-500" />
              <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400">
                {hiddenTask?.distanceText ?? "附近"}
              </span>
            </div>
            {!mystery && hiddenTask?.reward && (
              <div className="flex items-center gap-1.5 rounded-full bg-[#6C5CFF]/10 px-3 py-1.5">
                <Gift size={13} className="text-[#6C5CFF]" />
                <span className="text-[12px] font-bold text-[#6C5CFF] truncate max-w-[140px]">
                  {hiddenTask.reward}
                </span>
              </div>
            )}
          </div>

          {/* 按钮 */}
          <button
            onClick={onAccept}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-[15px] font-black text-white shadow-lg shadow-amber-500/25 transition-transform active:scale-[0.98]"
          >
            立即前往
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CameraInterface({ onCapture, onClose }: { onCapture: (photoDataUrl?: string) => void, onClose: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async (facing: "environment" | "user") => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraReady(true);
      setCameraError(false);
    } catch {
      setCameraError(true);
    }
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const switchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  const grabFrame = (): string | undefined => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return undefined;
    const canvas = document.createElement("canvas");
    const size = Math.min(video.videoWidth, 720);
    const scale = size / video.videoWidth;
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            const photo = grabFrame();
            setTimeout(() => onCapture(photo), 500);
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
      {/* Camera feed or fallback */}
      {cameraError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A1A]">
          <div className="text-center px-8">
            <Camera size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-[14px] text-white/50">无法访问摄像头</p>
            <p className="text-[11px] text-white/30 mt-1">请在浏览器设置中允许摄像头权限</p>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
        />
      )}
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative flex h-full flex-col justify-between p-6 pt-16 pb-12">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="rounded-full bg-black/40 p-2 text-white backdrop-blur-md">
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
            <button onClick={switchCamera} className="active:scale-90 transition-transform">
              <RefreshCw size={24} className="text-white/60" />
            </button>
            <button
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => !progress && setIsRecording(false)}
              onTouchStart={() => setIsRecording(true)}
              onTouchEnd={() => !progress && setIsRecording(false)}
              className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/40 p-1"
            >
              <div className={`h-full w-full rounded-full bg-white transition-all duration-300 ${isRecording ? "scale-90 rounded-lg bg-red-600 shadow-[0_0_20px_red]" : "scale-100"}`} />
            </button>
            <div className="h-8 w-8" />
          </div>
        </div>
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
      style={{ color: "#fff" }}
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
        <div className="rounded-[32px] border backdrop-blur-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}>
          {/* Toggle bar — always visible */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-between px-6 py-3 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                <Compass size={18} />
              </div>
              <span className="text-[15px] font-black italic tracking-tight" style={{ color: "var(--text-primary)" }}>当前位置</span>
              <div className="flex items-center gap-1.5 rounded-full bg-[#FFD166]/10 border border-[#FFD166]/20 px-2.5 py-0.5">
                <span className="text-[10px] font-bold text-[var(--accent-gold)] uppercase tracking-wider">五道口 · 北京</span>
              </div>
            </div>
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={18} style={{ color: "var(--text-faint)" }} />
            </motion.div>
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
                <div className="px-6 pb-6">
                  <p className="text-[13px] font-medium leading-relaxed mb-5 px-1" style={{ color: "var(--text-muted)" }}>
                    迷雾中隐藏着未知的惊喜，踏出第一步，解锁你的故事
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RewardOverlay({ onContinue, reward, emoji, name }: { onContinue: () => void; reward?: string; emoji?: string; name?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[120] flex items-center justify-center p-8 backdrop-blur-xl bg-black/40"
    >
      <div className="w-full max-w-xs rounded-3xl p-6 text-center border shadow-2xl relative overflow-hidden" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
        <div className="relative z-10">
          <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="mb-6 flex justify-center"
          >
            <div className="relative h-20 w-20 flex items-center justify-center bg-amber-500 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.5)]">
              <span className="text-4xl">{emoji ?? "✨"}</span>
            </div>
          </motion.div>

          <h2 className="text-2xl font-black italic" style={{ color: "var(--text-primary)" }}>{name ?? "打卡完成"}</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>解锁探索奖励</p>

          <div className="my-8">
            <div className="flex items-center justify-between rounded-xl p-3 border text-left" style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-subtle)" }}>
               <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6C5CFF]/20 text-[#6C5CFF]">
                     <Gift size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-bold line-clamp-2" style={{ color: "var(--text-primary)" }}>{reward ?? "优惠券"}</div>
                  </div>
               </div>
            </div>
          </div>

          <button
            onClick={onContinue}
            className="w-full rounded-2xl bg-[#6C5CFF] py-4 text-sm font-black text-white active:scale-95 transition-transform"
          >
            查收奖励
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
      <div className="w-full max-w-sm rounded-[40px] p-8 text-center border-2 relative overflow-hidden" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(108,92,255,0.12),transparent_70%)]" />

        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12 }}
            className="mb-8 flex justify-center"
          >
            <div className="h-32 w-32 rounded-full bg-gradient-to-tr from-[#6C5CFF] to-[#A855F7] p-1 shadow-[0_0_50px_rgba(108,92,255,0.6)]">
              <div className="h-full w-full rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--bg-card)" }}>
                 <Compass size={60} className="text-[#6C5CFF]" />
              </div>
            </div>
          </motion.div>
          <h3 className="text-[14px] font-black uppercase tracking-[0.3em] text-[#A855F7]">成就解锁</h3>
          <h2 className="mt-2 text-4xl font-black italic" style={{ color: "var(--text-primary)" }}>城市开拓者</h2>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            你完成了今日所有的探索计划，并用镜头记录下了这个城市鲜为人知的瞬间。
          </p>

          <div className="mt-10 flex flex-col gap-3">
            <button
              onClick={onContinue}
              className="w-full rounded-2xl bg-[#6C5CFF] py-4 text-[16px] font-black text-white active:scale-[0.98] transition-all"
            >
              完成探索
            </button>
            <p className="text-[11px] uppercase tracking-widest italic" style={{ color: "var(--text-faint)" }}>已录入世界探索名录</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const PreferenceOverlay: React.FC<{ onConfirm: (prefs: UserPreferences) => void; onBack: () => void }> = ({ onConfirm, onBack }) => {
  const { weather, weatherImage } = useWeather();
  const [mood, setMood] = useState("happy");
  const [duration, setDuration] = useState("1h");
  const [transport, setTransport] = useState("walk");
  const [special, setSpecial] = useState<string[]>(["outdoor"]);
  const [foodPreference, setFoodPreference] = useState<string[]>(["coffee"]);
  const [intensity, setIntensity] = useState("don't_think");
  const [companion, setCompanion] = useState("solo");

  const moods = [
    { id: "happy", icon: Smile, label: "开心" },
    { id: "tired", icon: Frown, label: "疲惫" },
    { id: "bored", icon: Meh, label: "无聊" },
    { id: "relax", icon: Wind, label: "想放松" },
    { id: "explore", icon: Search, label: "想探索" },
    { id: "hungry", icon: Utensils, label: "想吃好的" },
  ];

  const durations = [
    { id: "1h", label: "1小时" },
    { id: "2h", label: "2小时" },
    { id: "half_day", label: "半天" },
    { id: "full_day", label: "整天" },
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

  // 省心 → 冒险 的梯子，每档行为不同（sub 写明区别，就在「程度」问号旁的选择区里）
  const intensities: { id: string; icon: typeof Target; label: string; sub?: string; recommended?: boolean }[] = [
    { id: "don't_think", icon: Wand2, label: "别让我思考", sub: "隐藏下一站·直接带路", recommended: true },
    { id: "normal", icon: Book, label: "正常探索", sub: "显示目的地·有岔路" },
  ];

  const companions = [
    { id: "solo", icon: Users, label: "独自" },
    { id: "couple", icon: Users, label: "情侣" },
    { id: "friends", icon: Users, label: "朋友" },
    { id: "family", icon: Users, label: "亲子" },
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
      className="absolute inset-0 z-[100] flex flex-col"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="flex items-center px-4 py-4 mt-12">
        <button onClick={onBack} className="p-2 active:scale-90 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 text-center pr-10">
          <h2 className="flex items-center justify-center gap-2 text-xl font-black italic tracking-tight" style={{ color: "var(--text-primary)" }}>
             <Sparkles size={20} className="text-[#6C5CFF]" /> 今天想怎么走？ <Sparkles size={20} className="text-[#6C5CFF]" />
          </h2>
          <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>系统会结合你的偏好、天气和历史反馈生成路线</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-40 scrollbar-hide">
        <div className="relative mb-6 mt-1 overflow-hidden rounded-3xl p-4 shadow-xl border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}>
          {weatherImage && (
            <img src={weatherImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 dark:opacity-40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t dark:from-[#0F172A] dark:via-[#0F172A]/60 from-white/80 via-white/40 to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#6C5CFF]/10 blur-[60px] rounded-full" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold w-fit" style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
                <MapPin size={10} /> 五道口
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-3xl">{weather ? weatherEmoji(weather.icon) : "⏳"}</span>
                <div>
                  <div className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>{weather?.temp ?? "--"}°C</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{weather?.desc ?? "加载中"}</span>
                    {weather && (
                      <span className="rounded-full bg-[#6C5CFF]/15 border border-[#6C5CFF]/30 px-2 py-0.5 text-[9px] font-bold text-[#6C5CFF]">
                        {weatherAdvice(weather).tag}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right mt-3 shrink-0">
              <div className="text-[12px] font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                {weather ? `体感 ${weather.feelsLike}°C` : ""}
              </div>
              <p className="text-[10px] leading-tight max-w-[120px]" style={{ color: "var(--text-muted)" }}>
                {weather ? weatherAdvice(weather).tip : "正在获取天气..."}
              </p>
              {weather && (
                <div className="mt-1.5 flex justify-end gap-2.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <span>💧{weather.humidity}%</span>
                  <span>💨{weather.windSpeed}km/h</span>
                </div>
              )}
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
                mood === m.id ? "bg-[#6C5CFF]/15 border-[#6C5CFF] text-[#6C5CFF]" : "bg-white/90 dark:bg-white/10 border-transparent text-[var(--text-muted)]"
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
                    duration === d.id ? "bg-[#6C5CFF]/15 border-[#6C5CFF] text-[#6C5CFF] dark:text-white shadow-[0_0_15px_rgba(108,92,255,0.15)]" : "bg-white/90 dark:bg-white/10 border-transparent text-[var(--text-faint)]"
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
                     transport === t.id ? "bg-[#6C5CFF]/15 border-[#6C5CFF] text-[#6C5CFF] dark:text-white shadow-[0_0_15px_rgba(108,92,255,0.15)]" : "bg-white/90 dark:bg-white/10 border-transparent text-[var(--text-faint)]"
                   }`}
                 >
                   <t.icon size={12} />
                   {t.label}
                 </button>
               ))}
               <p className="text-[9px] text-center mt-1" style={{ color: "var(--text-faint)" }}>当前仅支持步行与公共交通</p>
             </div>
          </div>
        </div>

        <SectionTitle num={3} title="有没有特别想要？" sub="(可多选)" />
        <div className="flex flex-wrap gap-2 mb-4">
          {specials.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleList(special, setSpecial, s.id)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-[9px] font-bold transition-all ${
                special.includes(s.id) ? "bg-[#6C5CFF]/15 border-[#6C5CFF] text-[#6C5CFF] dark:text-white shadow-[0_0_15px_rgba(108,92,255,0.15)]" : "bg-white/90 dark:bg-white/10 border-transparent text-[var(--text-muted)]"
              }`}
            >
              <s.icon size={11} />
              {s.label}
            </button>
          ))}
        </div>

        <div className="text-[9px] font-bold mb-1.5 ml-0.5" style={{ color: "var(--text-faint)" }}>同行人</div>
        <div className="flex flex-wrap gap-2 mb-6">
          {companions.map((c) => (
            <button
              key={c.id}
              onClick={() => setCompanion(c.id)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-[9px] font-bold transition-all ${
                companion === c.id ? "bg-[#6C5CFF]/15 border-[#6C5CFF] text-[#6C5CFF] dark:text-white shadow-[0_0_15px_rgba(108,92,255,0.15)]" : "bg-white/90 dark:bg-white/10 border-transparent text-[var(--text-muted)]"
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
                foodPreference.includes(f.id) ? "bg-[#6C5CFF]/15 border-[#6C5CFF] text-[#6C5CFF] dark:text-white shadow-[0_0_15px_rgba(108,92,255,0.15)]" : "bg-white/90 dark:bg-white/10 border-transparent text-[var(--text-muted)]"
              }`}
            >
              <f.icon size={11} />
              {f.label}
            </button>
          ))}
        </div>

        <SectionTitle
          num={5}
          title="今天想被安排什么程度？"
          help={
            <div className="space-y-1.5">
              <div><span className="font-bold" style={{ color: "var(--text-primary)" }}>别让我思考</span>：隐藏下一站位置，不用选，直接带你逛</div>
              <div><span className="font-bold" style={{ color: "var(--text-primary)" }}>正常探索</span>：显示下一站位置，路上有岔路，你来选</div>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-2 mb-6">
          {intensities.map((i) => (
            <button
              key={i.id}
              onClick={() => setIntensity(i.id)}
              className={`relative flex flex-col items-center text-center gap-1 p-1 py-2.5 rounded-xl border transition-all ${
                intensity === i.id ? "bg-[#6C5CFF]/15 border-[#6C5CFF] text-[#6C5CFF] dark:text-white shadow-[0_0_20px_rgba(108,92,255,0.2)]" : "bg-white/90 dark:bg-white/10 border-transparent text-[var(--text-muted)]"
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

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] p-5" style={{ background: `linear-gradient(to top, var(--bg-base), var(--bg-base) 60%, transparent)` }}>
        <button
          onClick={() => onConfirm({ mood, duration, transport, special, foodPreference, intensity, companion })}
          className="group relative flex w-full items-center justify-center gap-3 rounded-full bg-[#6C5CFF] py-3.5 text-[16px] font-black text-white shadow-[0_15px_40px_rgba(108,92,255,0.4)] active:scale-[0.98] transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          <Sparkles size={18} className="fill-white" />
          <span>生成今日剧情</span>
        </button>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px]" style={{ color: "var(--text-faint)" }}>
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
      <h3 className="text-[13px] font-black tracking-wide" style={{ color: "var(--text-primary)" }}>{title}</h3>
      {sub && <span className="text-[10px] font-medium" style={{ color: "var(--text-faint)" }}>{sub}</span>}
      {help && (
        <span className="group relative inline-flex">
          <HelpCircle size={12} style={{ color: "var(--text-faint)" }} className="hover:opacity-70 cursor-help transition-colors" />
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full z-50 mt-2 w-56 rounded-xl border p-3 text-left text-[11px] leading-relaxed opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.1)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.55)] transition-opacity duration-150 group-hover:opacity-100" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-card)", color: "var(--text-secondary)" }}>
            {help}
          </span>
        </span>
      )}
    </div>
  );
}

const RAIN_CODES = new Set(["176","200","263","266","293","296","299","302","305","308","386","389","392"]);
const ID_CATEGORIES = new Set(["酒吧","酒吧清吧","夜店","KTV","livehouse"]);

function GearConfirmationOverlay({ onConfirm, onBack, weatherCode, generatedRoute }: { onConfirm: () => void; onBack: () => void; weatherCode?: string; generatedRoute?: GeneratedRoute | null }) {
  const needUmbrella = !!weatherCode && RAIN_CODES.has(weatherCode);
  const needId = !!generatedRoute && [
    ...generatedRoute.waypoints,
    ...(generatedRoute.hiddenTask ? [generatedRoute.hiddenTask] : []),
  ].some(wp => ID_CATEGORIES.has(wp.category ?? ""));

  const gearList = [
    { id: "phone", icon: Smartphone, label: "手机", desc: "满电状态" },
    { id: "battery", icon: Battery, label: "充电宝", desc: "以防万一" },
    ...(needUmbrella ? [{ id: "umbrella", icon: Umbrella, label: "雨伞", desc: "今天有雨，记得带伞" }] : []),
    ...(needId ? [{ id: "id_card", icon: CreditCard, label: "身份证", desc: "部分场所需实名入场" }] : []),
  ];

  const [confirmed, setConfirmed] = useState<string[]>([]);

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
      className="absolute inset-0 z-[100] flex flex-col"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="flex items-center px-4 py-4 mt-12">
        <button onClick={onBack} className="p-2 active:scale-90 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 text-center pr-10">
          <h2 className="flex items-center justify-center gap-2 text-xl font-black italic tracking-tight" style={{ color: "var(--text-primary)" }}>
             装备确认 <Rocket size={20} className="text-[#6C5CFF]" />
          </h2>
          <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>带上这些，让探索更从容</p>
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
                  ? "bg-[#6C5CFF]/15 border-[#6C5CFF] shadow-[0_8px_20px_rgba(108,92,255,0.15)]"
                  : ""
              }`}
              style={!confirmed.includes(item.id) ? { backgroundColor: "var(--bg-input)", borderColor: "var(--border-subtle)" } : undefined}
            >
              <div className={`p-2 rounded-xl ${confirmed.includes(item.id) ? "bg-[#6C5CFF] text-white" : ""}`} style={!confirmed.includes(item.id) ? { backgroundColor: "var(--bg-input)", color: "var(--text-faint)" } : undefined}>
                <item.icon size={20} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[14px] font-black" style={{ color: confirmed.includes(item.id) ? "var(--text-primary)" : "var(--text-faint)" }}>{item.label}</div>
                <div className="text-[10px]" style={{ color: confirmed.includes(item.id) ? "var(--text-muted)" : "var(--text-faint)" }}>{item.desc}</div>
              </div>
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                confirmed.includes(item.id) ? "border-[#6C5CFF] bg-[#6C5CFF]" : ""
              }`} style={!confirmed.includes(item.id) ? { borderColor: "var(--border-subtle)" } : undefined}>
                {confirmed.includes(item.id) && <CheckCircle2 size={12} className="text-white" />}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 p-4 rounded-2xl bg-[#6C5CFF]/10 border border-[#6C5CFF]/20">
          <div className="flex items-start gap-2.5">
            <Info size={16} className="text-[#6C5CFF] mt-0.5" />
            <div>
              <div className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>温馨提示</div>
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                部分探索点可能需要手机 NFC 或 4G 网络，请确保网络通畅并开启定位服务。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 pb-10" style={{ background: `linear-gradient(to top, var(--bg-base), var(--bg-base) 60%, transparent)` }}>
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
