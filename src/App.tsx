import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { ScreenType, ExploreStep, UserPreferences, GeneratedRoute, UserProfile, GeneratedVlog, TripRecord } from "./types";
import { ExploreScreen } from "./screens/ExploreScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { StoryScreen } from "./screens/StoryScreen";
import { BagScreen } from "./screens/BagScreen";
import { MineScreen } from "./screens/MineScreen";
import { EventDetailScreen } from "./screens/EventDetailScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { generateRoute } from "./agents/routeAgent";
import { ORIGIN } from "./components/mapProjection";
import { positionFromStep } from "./lib/derivePosition";
import { commitBranchChoice } from "./lib/branch";
import { chatWithRoute, type ChatAction } from "./agents/chatAgent";
import type { ChatMessage } from "./components/ChatPanel";
import type { LatLng } from "./components/mapProjection";
import { SAMPLE_TRIPS } from "./data/sampleTrips";
import { motion, AnimatePresence } from "motion/react";

const PROFILE_KEY = "userProfile";
const THEME_KEY = "appTheme";
const TRIP_HISTORY_KEY = "tripHistory";
const VLOG_HISTORY_KEY = "vlogHistory";

function loadTripHistory(): TripRecord[] {
  try {
    const raw = localStorage.getItem(TRIP_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TripRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  try { localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(SAMPLE_TRIPS)); } catch {}
  return SAMPLE_TRIPS;
}

function loadVlogHistory(): GeneratedVlog[] {
  try {
    const raw = localStorage.getItem(VLOG_HISTORY_KEY);
    if (raw) return JSON.parse(raw) as GeneratedVlog[];
  } catch {}
  return [];
}

function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (typeof parsed?.completedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function App() {
  // 主题：暗色(dark) / 浅色(light)。优先读 localStorage，无则按时间（6:00-18:00 日间）
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as "dark" | "light" | null;
      if (saved) return saved;
    } catch {}
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18 ? "light" : "dark";
  });
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  };

  // 首启时从 localStorage 读取 profile，缺失则进 onboarding；否则直接 explore
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile());
  const [screen, setScreen] = useState<ScreenType>(() => (loadProfile() ? "explore" : "onboarding"));
  const [exploreStep, setExploreStep] = useState<ExploreStep>("intro");
  const [waypointIndex, setWaypointIndex] = useState(0);

  // 存储用户填写的偏好
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  // 存储 AI 生成的路线
  const [generatedRoute, setGeneratedRoute] = useState<GeneratedRoute | null>(null);
  // Vlog（从 localStorage 恢复 + session 内新增）
  const [generatedVlogs, setGeneratedVlogs] = useState<GeneratedVlog[]>(() => loadVlogHistory());
  // 是否正在加载
  const [isGenerating, setIsGenerating] = useState(false);
  // 如果出错，存储错误信息
  const [generateError, setGenerateError] = useState<string | null>(null);

  // 历史记录（持久化到 localStorage）
  const [tripHistory, setTripHistory] = useState<TripRecord[]>(() => loadTripHistory());
  const [showFeedback, setShowFeedback] = useState(false);

  // 行为信号追踪（不驱动渲染，用 useRef）
  const tripStartTime = useRef<number | null>(null);
  const branchChosenRef = useRef<number | undefined>(undefined);
  const chatActionLog = useRef<string[]>([]);
  const hiddenTriggered = useRef(false);
  const pendingRecord = useRef<TripRecord | null>(null);

  // Chatbot 状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const handleChatSend = async (text: string) => {
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);
    try {
      const resp = await chatWithRoute(text, generatedRoute, preferences ?? DEFAULT_PREFERENCES, currentPosition);
      setChatMessages((prev) => [...prev, { role: "assistant", text: resp.message }]);
      applyAction(resp.action);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "出了点问题，稍后再试" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const applyAction = (action: ChatAction) => {
    if (!action || action.type === "none" || !generatedRoute || showFeedback) return;
    chatActionLog.current.push(action.type);
    const wp = action.waypoint;
    if (action.type === "replace_next" && wp) {
      setGeneratedRoute((r) => {
        if (!r) return r;
        const wps = [...r.waypoints];
        if (wps.length > 1) wps[wps.length - 1] = wp;
        else wps.push(wp);
        return { ...r, waypoints: wps };
      });
      setChatMessages((prev) => [...prev, { role: "system", text: `✓ 下一站已替换为「${wp.name}」` }]);
    } else if (action.type === "skip_current") {
      if (exploreStep === "initial" || exploreStep === "checkin_initial") {
        setExploreStep("hidden_found");
      } else if (exploreStep === "next_objective" || exploreStep === "checkin_next") {
        setExploreStep("achievement_unlock");
      }
      setChatMessages((prev) => [...prev, { role: "system", text: "✓ 已跳过当前站" }]);
    } else if (action.type === "add_stop" && wp) {
      setGeneratedRoute((r) => {
        if (!r) return r;
        return { ...r, waypoints: [...r.waypoints, wp] };
      });
      setChatMessages((prev) => [...prev, { role: "system", text: `✓ 已在路线末尾加了「${wp.name}」` }]);
    }
  };

  // 用户拖动小人模拟走路时设置；非空就盖过 step-derived 位置（用于测试）
  // 路线重新生成时清空，避免上一次的拖动位置粘在新路线上
  const [overridePosition, setOverridePosition] = useState<LatLng | null>(null);

  // 根据当前 ExploreStep + 路线推导用户在地图上的位置
  const stepPosition = useMemo(
    () => positionFromStep(exploreStep, generatedRoute, ORIGIN, waypointIndex),
    [exploreStep, generatedRoute, waypointIndex]
  );
  const currentPosition = overridePosition ?? stepPosition;

  const navigate = (next: ScreenType) => {
    setScreen(next);
  };

  // 用户没填偏好就直接"开始探索"时用的默认值（探索 / 1 小时 / 步行 / 不挑）
  const DEFAULT_PREFERENCES: UserPreferences = {
    mood: "explore",
    duration: "1h",
    transport: "walk",
    special: [],
    foodPreference: [],
    intensity: "normal",
  };

  // 生成路线主流程：从任意入口（直接开始 / 偏好页确认）汇聚到这里
  const runGeneration = async (prefs: UserPreferences) => {
    setPreferences(prefs);
    setIsGenerating(true);
    setGenerateError(null);
    // 重置行为信号
    tripStartTime.current = Date.now();
    branchChosenRef.current = undefined;
    chatActionLog.current = [];
    hiddenTriggered.current = false;
    try {
      const route = await generateRoute(prefs, profile);
      setGeneratedRoute(route);
      setOverridePosition(null);
      setWaypointIndex(0);
      console.log("AI 生成的路线：", route);
      setExploreStep("initial");
    } catch (err) {
      console.error("生成路线失败：", err);
      setGenerateError("路线生成失败，请重试");
      setExploreStep("initial");
    } finally {
      setIsGenerating(false);
    }
  };

  // 冷启动完成
  const handleOnboardingComplete = (p: UserProfile) => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    } catch (e) {
      console.warn("写 userProfile 到 localStorage 失败：", e);
    }
    setProfile(p);
    setScreen("explore");
  };

  // intro → 直接开始
  const handleDirectStart = () => {
    runGeneration(DEFAULT_PREFERENCES);
  };

  // 偏好页确认
  const handlePreferenceConfirm = (prefs: UserPreferences) => {
    runGeneration(prefs);
  };

  // 二叉树 A/B：用户选定第二站 → 写回 waypoints[1] → 进 next_objective
  const handleBranchChoice = (index: number) => {
    branchChosenRef.current = index;
    setGeneratedRoute((r) => (r ? commitBranchChoice(r, index) : r));
    setOverridePosition(null);
    setWaypointIndex((prev) => prev + 1);
    setExploreStep("next_objective");
  };

  // 追踪 hidden_active 触发 + achievement_unlock 组装 TripRecord
  useEffect(() => {
    if (exploreStep === "hidden_active") {
      hiddenTriggered.current = true;
    }
  }, [exploreStep]);

  const handleAchievementContinue = useCallback(() => {
    if (!generatedRoute || !preferences) {
      setExploreStep("intro");
      return;
    }
    const wps = generatedRoute.waypoints.map((w, i) => ({
      name: w.name, emoji: w.emoji, lat: w.lat, lng: w.lng, visited: i <= waypointIndex,
    }));
    if (generatedRoute.hiddenTask) {
      wps.push({
        name: generatedRoute.hiddenTask.name,
        emoji: generatedRoute.hiddenTask.emoji,
        lat: generatedRoute.hiddenTask.lat,
        lng: generatedRoute.hiddenTask.lng,
        visited: hiddenTriggered.current,
        isHidden: true,
      });
    }
    const elapsed = tripStartTime.current ? Math.round((Date.now() - tripStartTime.current) / 60000) : 30;
    const allRewards = generatedRoute.waypoints.map((w) => w.reward);
    if (generatedRoute.hiddenTask && hiddenTriggered.current) {
      allRewards.push(generatedRoute.hiddenTask.reward);
    }

    pendingRecord.current = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      waypoints: wps,
      branchChosen: branchChosenRef.current,
      chatActions: [...chatActionLog.current],
      distanceKm: 0,
      durationMin: elapsed,
      rewards: allRewards,
      intensity: preferences.intensity,
      preferences,
    };

    // 异步算距离（动态导入避免首屏加载路网）
    import("./lib/routeGeometry").then(({ computeVlogGeo }) => {
      try {
        const geo = computeVlogGeo(generatedRoute);
        if (pendingRecord.current) pendingRecord.current.distanceKm = Math.round(geo.distanceKm * 10) / 10;
      } catch {}
    }).catch(() => {});

    setShowFeedback(true);
  }, [generatedRoute, preferences]);

  const saveTripRecord = useCallback((reaction?: string) => {
    const record = pendingRecord.current;
    if (!record) {
      setShowFeedback(false);
      setExploreStep("intro");
      return;
    }
    if (reaction) record.reaction = reaction;
    const updated = [record, ...tripHistory];
    setTripHistory(updated);
    try { localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(updated)); } catch {}
    pendingRecord.current = null;
    setShowFeedback(false);
    setChatMessages([]);
    setExploreStep("intro");
  }, [tripHistory]);

  // 历史记录补反馈（整条路线）
  const handleTripReaction = useCallback((tripId: string, emoji: string) => {
    setTripHistory((prev) => {
      const updated = prev.map((t) => t.id === tripId ? { ...t, reaction: emoji } : t);
      try { localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // 历史记录补反馈（单个站点）
  const handleWaypointReaction = useCallback((tripId: string, waypointIdx: number, emoji: string) => {
    setTripHistory((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== tripId) return t;
        const wps = t.waypoints.map((w, i) => i === waypointIdx ? { ...w, reaction: emoji } : w);
        return { ...t, waypoints: wps };
      });
      try { localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // Vlog 生成后持久化
  const handleVlogGenerated = useCallback((v: GeneratedVlog) => {
    setGeneratedVlogs((prev) => {
      const updated = [v, ...prev];
      try { localStorage.setItem(VLOG_HISTORY_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  return (
    <div data-theme={theme} className="h-full w-full font-[PingFang_SC,Inter,system-ui,sans-serif]" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* 加载中的全屏遮罩 */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center backdrop-blur-md"
            style={{ backgroundColor: theme === "dark" ? "rgba(5,6,15,0.95)" : "rgba(245,245,250,0.95)" }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="h-12 w-12 rounded-full border-4 border-white/10 border-t-[#6C5CFF]"
            />
            <p className="mt-6 text-[15px] font-bold text-white/60">AI 正在为你规划路线…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
           key={screen}
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           transition={{ duration: 0.3 }}
           className="h-full w-full"
        >
          {screen === "onboarding" && (
            <OnboardingScreen onComplete={handleOnboardingComplete} />
          )}
          {screen === "explore" && (
            <ExploreScreen
              step={exploreStep}
              setStep={setExploreStep}
              onNavigate={navigate}
              onPreferenceConfirm={handlePreferenceConfirm}
              onDirectStart={handleDirectStart}
              generatedRoute={generatedRoute}
              currentPosition={currentPosition}
              onUserDrag={setOverridePosition}
              onBranchChoice={handleBranchChoice}
              mystery={preferences?.intensity === "relaxed"}
              waypointIndex={waypointIndex}
              onAdvanceWaypoint={() => {
                const next = waypointIndex + 1;
                if (next < (generatedRoute?.waypoints.length ?? 0)) {
                  setWaypointIndex(next);
                  setOverridePosition(null);
                  setExploreStep("next_objective");
                } else {
                  setExploreStep("achievement_unlock");
                }
              }}
              chatMessages={chatMessages}
              chatLoading={chatLoading}
              onChatSend={handleChatSend}
              showFeedback={showFeedback}
              onAchievementContinue={handleAchievementContinue}
              onFeedbackReact={(emoji) => saveTripRecord(emoji)}
              onFeedbackDismiss={() => saveTripRecord()}
            />
          )}
          {screen === "story" && (
            <StoryScreen
              onNavigate={navigate}
              generatedRoute={generatedRoute}
              vlogs={generatedVlogs}
              onVlogGenerated={handleVlogGenerated}
              tripHistory={tripHistory}
              onTripReaction={handleTripReaction}
              onWaypointReaction={handleWaypointReaction}
            />
          )}
          {screen === "bag" && <BagScreen onNavigate={navigate} generatedRoute={generatedRoute} />}
          {screen === "mine" && <MineScreen onNavigate={navigate} profile={profile} generatedRoute={generatedRoute} tripHistory={tripHistory} />}
          {screen === "event" && <EventDetailScreen onBack={() => navigate("explore")} />}
          {screen === "settings" && <SettingsScreen onBack={() => navigate("mine")} theme={theme} onToggleTheme={toggleTheme} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
