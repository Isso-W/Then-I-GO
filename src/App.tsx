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
import { reviewRoute } from "./agents/routeReviewer";
import { findPOIByName, getBaseCategory } from "./agents/poiFilter";
import { ORIGIN } from "./components/mapProjection";
import { positionFromStep } from "./lib/derivePosition";
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
  type ThemeMode = "dark" | "light" | "auto";
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
      if (saved === "dark" || saved === "light" || saved === "auto") return saved;
    } catch {}
    return "auto";
  });
  const autoTheme = (): "dark" | "light" => {
    const h = new Date().getHours();
    return h >= 6 && h < 18 ? "light" : "dark";
  };
  const theme: "dark" | "light" = themeMode === "auto" ? autoTheme() : themeMode;
  const setThemeChoice = (mode: ThemeMode) => {
    setThemeMode(mode);
    try { localStorage.setItem(THEME_KEY, mode); } catch {}
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
  const chatActionLog = useRef<string[]>([]);
  const [hiddenTriggered, setHiddenTriggered] = useState(false);
  const pendingRecord = useRef<TripRecord | null>(null);
  const weatherRef = useRef<{ code?: string; temp?: number }>({});

  // 打卡拍照暂存（genStop index → dataURL），传给 StoryScreen 预填充
  const [checkinPhotos, setCheckinPhotos] = useState<Record<number, string>>({});
  const handleCheckinPhoto = useCallback((stopIndex: number, dataUrl: string) => {
    setCheckinPhotos((prev) => ({ ...prev, [stopIndex]: dataUrl }));
  }, []);

  // Chatbot 状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const handleChatSend = async (text: string) => {
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);
    try {
      const resp = await chatWithRoute(text, generatedRoute, preferences ?? DEFAULT_PREFERENCES, currentPosition, waypointIndex, tripHistory, weatherRef.current.code, weatherRef.current.temp);
      setChatMessages((prev) => [...prev, { role: "assistant", text: resp.message }]);
      applyAction(resp.action);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "出了点问题，稍后再试" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const reviewModifiedRoute = async (modified: GeneratedRoute, lockedIdx: number) => {
    console.log("🔍 聊天改路线 → 启动审查，锁定前", lockedIdx + 1, "站:", modified.waypoints.slice(0, lockedIdx + 1).map(w => w.name));
    try {
      const cats = modified.waypoints.map(
        (w) => findPOIByName(w.name)?.category ?? "未知"
      );
      if (modified.hiddenTask) cats.push(findPOIByName(modified.hiddenTask.name)?.category ?? "未知");
      const result = await reviewRoute(modified, cats, preferences ?? DEFAULT_PREFERENCES);

      if (result.action === "reorder" && result.reorder) {
        const nameOrder = result.reorder;
        const wpMap = new Map(modified.waypoints.map((w) => [w.name, w]));
        const hidden = modified.hiddenTask;

        const locked = modified.waypoints.slice(0, lockedIdx + 1);
        const futureNames = new Set(
          modified.waypoints.slice(lockedIdx + 1).map((w) => w.name)
        );
        const reorderedFuture = nameOrder
          .filter((n) => futureNames.has(n) && n !== hidden?.name)
          .map((n) => wpMap.get(n)!);

        console.log("🔀 审查建议调序 | 原未来站:", [...futureNames], "→ 新顺序:", reorderedFuture.map(w => w.name));

        if (reorderedFuture.length === futureNames.size) {
          const finalWaypoints = [...locked, ...reorderedFuture];
          setGeneratedRoute((r) => r ? { ...r, waypoints: finalWaypoints } : r);
          const futurePreview = reorderedFuture.map((w) => w.name).join(" → ");
          if (futurePreview) {
            setChatMessages((prev) => [...prev, {
              role: "system",
              text: `🔀 后续路线已优化：${futurePreview}`,
            }]);
          }
        } else {
          console.warn("🔀 审查调序数量不匹配，跳过:", reorderedFuture.length, "vs", futureNames.size);
        }
      } else if (result.action === "reselect") {
        const issueText = result.issues.map((i) => i.description).join("；");
        console.log("⚠️ 审查建议重选:", issueText);
        setChatMessages((prev) => [...prev, { role: "system", text: `⚠️ 审查提示：${issueText}` }]);
      } else {
        console.log("✅ 聊天改路线审查通过");
      }
    } catch (e) {
      console.error("聊天改路线审查失败:", e);
      // 审查失败不阻塞
    }
  };

  const applyAction = (action: ChatAction) => {
    if (!action || action.type === "none" || !generatedRoute || showFeedback) return;
    chatActionLog.current.push(action.type);
    const wp = action.waypoint;
    if (action.type === "replace_current" && wp) {
      const idx = waypointIndex;
      const modified = { ...generatedRoute, waypoints: [...generatedRoute.waypoints] };
      modified.waypoints[idx] = wp;
      setGeneratedRoute(modified);
      setChatMessages((prev) => [...prev, { role: "system", text: `✓ 当前站已替换为「${wp.name}」` }]);
      reviewModifiedRoute(modified, waypointIndex);
    } else if (action.type === "skip_current") {
      if (waypointIndex < generatedRoute.waypoints.length - 1) {
        setWaypointIndex((i) => i + 1);
        setExploreStep("next_objective");
      } else {
        setExploreStep("achievement_unlock");
      }
      setChatMessages((prev) => [...prev, { role: "system", text: "✓ 已跳过当前站" }]);
    } else if (action.type === "add_stop" && wp) {
      const modified = { ...generatedRoute, waypoints: [...generatedRoute.waypoints, wp] };
      setGeneratedRoute(modified);
      setChatMessages((prev) => [...prev, { role: "system", text: `✓ 已在路线末尾加了「${wp.name}」` }]);
      reviewModifiedRoute(modified, waypointIndex);
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

  // 用户没填偏好就直接"开始探索"时用的默认值（探索 / 半天 / 步行 / 不挑）
  const DEFAULT_PREFERENCES: UserPreferences = {
    mood: "explore",
    duration: "half_day",
    transport: "walk",
    special: ["outdoor"],
    foodPreference: [],
    intensity: "don't_think",
    companion: "solo",
  };

  // 生成路线主流程：从任意入口（直接开始 / 偏好页确认）汇聚到这里
  const runGeneration = async (prefs: UserPreferences) => {
    setPreferences(prefs);
    setIsGenerating(true);
    setGenerateError(null);
    // 重置行为信号
    tripStartTime.current = Date.now();
    chatActionLog.current = [];
    setHiddenTriggered(false);
    try {
      let wCode: string | undefined;
      let wTemp: number | undefined;
      try {
        const w = await fetch("/api/weather").then(r => r.json());
        wCode = w.icon;
        wTemp = parseInt(w.temp);
        weatherRef.current = { code: wCode, temp: wTemp };
      } catch {}
      const route = await generateRoute(prefs, profile, tripHistory, wCode, wTemp);
      setGeneratedRoute(route);
      setOverridePosition(null);
      setWaypointIndex(0);
      setCheckinPhotos({});
      console.log("AI 生成的路线：", route);
      setExploreStep("gear_confirmation");
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

  // intro → 直接开始（跳过偏好，直接生成路线）
  const handleDirectStart = () => {
    runGeneration(DEFAULT_PREFERENCES);
  };

  // 偏好页确认 → 直接生成路线（路线生成完成后进装备确认）
  const handlePreferenceConfirm = (prefs: UserPreferences) => {
    runGeneration(prefs);
  };

  // 装备确认 → 开始探索
  const handleGearConfirm = () => {
    setExploreStep("initial");
  };

  // 追踪 hidden_active 触发 + achievement_unlock 组装 TripRecord
  useEffect(() => {
    if (exploreStep === "hidden_active") {
      setHiddenTriggered(true);
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
        visited: hiddenTriggered,
        isHidden: true,
      });
    }
    const elapsed = tripStartTime.current ? Math.round((Date.now() - tripStartTime.current) / 60000) : 30;
    const allRewards = generatedRoute.waypoints.map((w) => w.reward);
    if (generatedRoute.hiddenTask && hiddenTriggered) {
      allRewards.push(generatedRoute.hiddenTask.reward);
    }

    pendingRecord.current = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      waypoints: wps,
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
        const geo = computeVlogGeo(generatedRoute, hiddenTriggered);
        if (pendingRecord.current) pendingRecord.current.distanceKm = Math.round(geo.distanceKm * 10) / 10;
      } catch {}
    }).catch(() => {});

    setShowFeedback(true);
  }, [generatedRoute, preferences, hiddenTriggered, waypointIndex]);

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

  const handleTripFeedback = useCallback((tripId: string, text: string) => {
    setTripHistory((prev) => {
      const updated = prev.map((t) => t.id === tripId ? { ...t, feedback: text } : t);
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
            style={{ backgroundColor: "var(--overlay-bg)" }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="h-12 w-12 rounded-full border-4 border-t-[#6C5CFF]"
              style={{ borderColor: "var(--border-subtle)", borderTopColor: "#6C5CFF" }}
            />
            <p className="mt-6 text-[15px] font-bold" style={{ color: "var(--text-muted)" }}>AI 正在为你规划路线…</p>
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
              onGearConfirm={handleGearConfirm}
              weatherCode={weatherRef.current.code}
              generatedRoute={generatedRoute}
              currentPosition={currentPosition}
              onUserDrag={setOverridePosition}
              mystery={preferences?.intensity === "don't_think"}
              waypointIndex={waypointIndex}
              onAdvanceWaypoint={() => {
                const next = waypointIndex + 1;
                if (next < (generatedRoute?.waypoints.length ?? 0)) {
                  setWaypointIndex(next);
                  setOverridePosition(null);
                  setExploreStep("next_objective");
                } else if (generatedRoute?.hiddenTask) {
                  setExploreStep("hidden_found");
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
              onCheckinPhoto={handleCheckinPhoto}
            />
          )}
          {screen === "story" && (
            <StoryScreen
              onNavigate={navigate}
              generatedRoute={generatedRoute}
              checkinPhotos={checkinPhotos}
              vlogs={generatedVlogs}
              onVlogGenerated={handleVlogGenerated}
              tripHistory={tripHistory}
              onTripReaction={handleTripReaction}
              onWaypointReaction={handleWaypointReaction}
              onTripFeedback={handleTripFeedback}
              mystery={preferences?.intensity === "don't_think"}
              waypointIndex={waypointIndex}
              hiddenTriggered={hiddenTriggered}
            />
          )}
          {screen === "bag" && <BagScreen onNavigate={navigate} generatedRoute={generatedRoute} />}
          {screen === "mine" && <MineScreen onNavigate={navigate} profile={profile} generatedRoute={generatedRoute} tripHistory={tripHistory} onUpdateProfile={setProfile} />}
          {screen === "event" && <EventDetailScreen onBack={() => navigate("explore")} />}
          {screen === "settings" && <SettingsScreen onBack={() => navigate("mine")} themeMode={themeMode} onThemeChange={setThemeChoice} profile={profile} onUpdateProfile={setProfile} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
