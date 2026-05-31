import { useMemo } from "react";
import { motion } from "motion/react";
import type { VlogStyle } from "../types";

// "活的静图"(Live2D idle 风)运镜池：持续往返的微呼吸(scale)+微摇(x)+微浮(y)+极小旋转，
// 循环 easeInOut，让用户上传的静帧有立绘呼吸感。scale>=1.05、平移/旋转极小，不露边。
const LIVE = [
  { scale: [1.06, 1.12, 1.06], x: ["-1%", "1.4%", "-1%"], y: ["0%", "-0.8%", "0%"], rotate: [-0.4, 0.4, -0.4], dur: 7 },
  { scale: [1.11, 1.06, 1.11], x: ["1.2%", "-1.4%", "1.2%"], y: ["-0.6%", "0.6%", "-0.6%"], rotate: [0.5, -0.5, 0.5], dur: 6.5 },
  { scale: [1.07, 1.12, 1.07], x: ["0%", "0.7%", "0%"], y: ["1%", "-1.2%", "1%"], rotate: [-0.3, 0.3, -0.3], dur: 6 },
  { scale: [1.05, 1.13, 1.05], x: ["0.6%", "-0.6%", "0.6%"], y: ["0.4%", "-0.5%", "0.4%"], rotate: [-0.6, 0.6, -0.6], dur: 8 },
  { scale: [1.09, 1.12, 1.09], x: ["-1.3%", "1.3%", "-1.3%"], y: ["0.9%", "-0.9%", "0.9%"], rotate: [0.4, -0.5, 0.4], dur: 7.5 },
  { scale: [1.08, 1.14, 1.08], x: ["0.8%", "-1%", "0.8%"], y: ["-0.5%", "0.7%", "-0.5%"], rotate: [0.3, -0.4, 0.3], dur: 6.8 },
];

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

// 每种风格的附加纹理层（成片质感）
function StyleTexture({ style }: { style: VlogStyle }) {
  if (style === "cyberpunk") {
    return (
      <>
        <div className="absolute inset-0 opacity-25 mix-blend-overlay pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,.6) 2px 3px)" }} />
        <motion.div className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-cyan-400/30 to-transparent mix-blend-screen pointer-events-none" animate={{ y: ["-40%", "140%"] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
      </>
    );
  }
  if (style === "retro") {
    return (
      <>
        <motion.div className="absolute inset-0 opacity-[0.18] mix-blend-overlay pointer-events-none" style={{ backgroundImage: GRAIN, backgroundSize: "120px 120px" }} animate={{ backgroundPositionX: ["0px", "120px"], backgroundPositionY: ["0px", "-120px"] }} transition={{ duration: 0.4, repeat: Infinity, ease: "steps(4)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 140px 50px rgba(80,40,10,0.7)" }} />
      </>
    );
  }
  return (
    <motion.div className="absolute -inset-10 pointer-events-none mix-blend-screen" style={{ background: "radial-gradient(circle at 75% 20%, rgba(255,240,200,0.35), transparent 45%)" }} animate={{ opacity: [0.4, 0.75, 0.4] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
  );
}

/**
 * 一张"会呼吸"的用户照片特写：Live2D idle 运镜 + 风格滤镜 + 纹理 + 字幕旁白。
 * 路线回放每到一站就切到这张（对应该站用户上传/占位的照片）。
 */
export function LivePhoto({
  frame, style, filter, overlay, accent, emoji, caption, narration, label,
}: {
  frame: string;
  style: VlogStyle;
  filter: string;    // STYLE_META[style].filter
  overlay: string;   // STYLE_META[style].overlay
  accent: string;
  emoji: string;
  caption: string;
  narration: string;
  label?: string;    // 如 "第 2 站 / 4"
}) {
  const preset = useMemo(() => LIVE[Math.floor(Math.random() * LIVE.length)], [frame]);
  const loop = { duration: preset.dur, repeat: Infinity, repeatType: "loop" as const, ease: "easeInOut" as const };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.img
        src={frame}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, scale: preset.scale, x: preset.x, y: preset.y, rotate: preset.rotate }}
        transition={{ opacity: { duration: 0.5 }, scale: loop, x: loop, y: loop, rotate: loop }}
        className={`absolute inset-0 h-full w-full object-cover ${filter}`}
      />
      <div className={`absolute inset-0 ${overlay}`} />
      <StyleTexture style={style} />
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 110px 30px rgba(0,0,0,0.55)" }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6 pb-12">
        {label && (
          <div className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black" style={{ background: `${accent}33`, color: accent }}>
            {label}
          </div>
        )}
        <div className="text-4xl drop-shadow-lg">{emoji}</div>
        <div className="mt-2 text-[26px] font-black italic leading-tight text-white drop-shadow-lg">{caption}</div>
        <p className="mt-2 max-w-[82%] text-[14px] leading-relaxed text-white/85 drop-shadow">{narration}</p>
      </div>
    </div>
  );
}
