import React, { useState } from "react";
import { ScreenType, ExploreStep, UserPreferences, GeneratedRoute } from "./types";
import { ExploreScreen } from "./screens/ExploreScreen";
import { StoryScreen } from "./screens/StoryScreen";
import { BagScreen } from "./screens/BagScreen";
import { MineScreen } from "./screens/MineScreen";
import { EventDetailScreen } from "./screens/EventDetailScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { generateRoute } from "./agents/routeAgent";
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

  const navigate = (next: ScreenType) => {
    setScreen(next);
  };

  // 用户在偏好页点"生成今日剧情"时调用
  const handlePreferenceConfirm = (prefs: UserPreferences) => {
    setPreferences(prefs);
    // 先跳到装备确认页
    setExploreStep("gear_confirmation");
  };

  // 用户在装备确认页点"开始探索"时调用
  const handleGearConfirm = async () => {
    if (!preferences) return;

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const route = await generateRoute(preferences);
      setGeneratedRoute(route);
      console.log("AI 生成的路线：", route); // 先在控制台看一下效果
      setExploreStep("initial");
    } catch (err) {
      console.error("生成路线失败：", err);
      setGenerateError("路线生成失败，请重试");
      // 出错了也让用户继续，用默认的模拟数据
      setExploreStep("initial");
    } finally {
      setIsGenerating(false);
    }
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
              onGearConfirm={handleGearConfirm}
              generatedRoute={generatedRoute}
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
