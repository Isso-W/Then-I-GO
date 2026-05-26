import React, { useMemo, useState } from "react";
import { ScreenType, ExploreStep, UserPreferences, GeneratedRoute } from "./types";
import { ExploreScreen } from "./screens/ExploreScreen";
import { StoryScreen } from "./screens/StoryScreen";
import { BagScreen } from "./screens/BagScreen";
import { MineScreen } from "./screens/MineScreen";
import { EventDetailScreen } from "./screens/EventDetailScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { generateRoute } from "./agents/routeAgent";
import { ORIGIN } from "./components/mapProjection";
import { positionFromStep } from "./lib/derivePosition";
import type { LatLng } from "./components/mapProjection";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [screen, setScreen] = useState<ScreenType>("explore");
  const [exploreStep, setExploreStep] = useState<ExploreStep>("intro");

  // 存储用户填写的偏好
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  // 存储 AI 生成的路线
  const [generatedRoute, setGeneratedRoute] = useState<GeneratedRoute | null>(null);
  // 是否正在加载
  const [isGenerating, setIsGenerating] = useState(false);
  // 如果出错，存储错误信息
  const [generateError, setGenerateError] = useState<string | null>(null);

  // 用户拖动小人模拟走路时设置；非空就盖过 step-derived 位置（用于测试）
  // 路线重新生成时清空，避免上一次的拖动位置粘在新路线上
  const [overridePosition, setOverridePosition] = useState<LatLng | null>(null);

  // 根据当前 ExploreStep + 路线推导用户在地图上的位置
  const stepPosition = useMemo(
    () => positionFromStep(exploreStep, generatedRoute, ORIGIN),
    [exploreStep, generatedRoute]
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
    try {
      const route = await generateRoute(prefs);
      setGeneratedRoute(route);
      setOverridePosition(null); // 新路线 = 清掉拖动位置
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

  // intro → 直接开始
  const handleDirectStart = () => {
    runGeneration(DEFAULT_PREFERENCES);
  };

  // 偏好页确认
  const handlePreferenceConfirm = (prefs: UserPreferences) => {
    runGeneration(prefs);
  };

  return (
    <div className="h-full w-full bg-[#05060F] font-[PingFang_SC,Inter,system-ui,sans-serif] text-white">
      {/* 加载中的全屏遮罩 */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#05060F]/95 backdrop-blur-md"
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
            />
          )}
          {screen === "story" && <StoryScreen onNavigate={navigate} />}
          {screen === "bag" && <BagScreen onNavigate={navigate} />}
          {screen === "mine" && <MineScreen onNavigate={navigate} />}
          {screen === "event" && <EventDetailScreen onBack={() => navigate("explore")} />}
          {screen === "settings" && <SettingsScreen onBack={() => navigate("mine")} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
