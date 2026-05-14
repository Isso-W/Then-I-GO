import React, { useState } from "react";
import { ScreenType, ExploreStep } from "./types";
import { ExploreScreen } from "./screens/ExploreScreen";
import { StoryScreen } from "./screens/StoryScreen";
import { BagScreen } from "./screens/BagScreen";
import { MineScreen } from "./screens/MineScreen";
import { EventDetailScreen } from "./screens/EventDetailScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [screen, setScreen] = useState<ScreenType>("explore");
  const [exploreStep, setExploreStep] = useState<ExploreStep>("intro");

  const navigate = (next: ScreenType) => {
    setScreen(next);
  };

  return (
    <div className="h-full w-full bg-[#05060F] font-[PingFang_SC,Inter,system-ui,sans-serif] text-white">
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
