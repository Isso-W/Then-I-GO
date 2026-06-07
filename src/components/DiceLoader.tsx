import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

const FACES = ["☕", "🎨", "🌳", "🍜", "🎵", "📸"];
const MESSAGES = [
  "命运骰子掷出中…",
  "解读你的心情…",
  "扫描附近 200 个地点…",
  "编排路线节奏…",
  "AI 质检路线中…",
  "即将揭晓…",
];

const S = 72;
const H = S / 2;

export function DiceLoader() {
  const cubeRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t++;
      const bounce = Math.sin(t * 0.035) * 14;
      if (cubeRef.current) {
        cubeRef.current.style.transform =
          `translateY(${bounce}px) rotateX(${t * 1.1}deg) rotateY(${t * 0.8}deg)`;
      }
      if (shadowRef.current) {
        const lift = (bounce + 14) / 28;
        const scale = 0.7 + lift * 0.6;
        const opacity = 0.35 - lift * 0.2;
        shadowRef.current.style.transform = `translateX(-50%) scaleX(${scale})`;
        shadowRef.current.style.opacity = `${opacity}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div style={{ perspective: 600 }} className="relative mb-10">
        <div
          ref={cubeRef}
          style={{ width: S, height: S, transformStyle: "preserve-3d", position: "relative" }}
        >
          <Face emoji={FACES[0]} transform={`translateZ(${H}px)`} />
          <Face emoji={FACES[1]} transform={`rotateY(180deg) translateZ(${H}px)`} />
          <Face emoji={FACES[2]} transform={`rotateY(90deg) translateZ(${H}px)`} />
          <Face emoji={FACES[3]} transform={`rotateY(-90deg) translateZ(${H}px)`} />
          <Face emoji={FACES[4]} transform={`rotateX(90deg) translateZ(${H}px)`} />
          <Face emoji={FACES[5]} transform={`rotateX(-90deg) translateZ(${H}px)`} />
        </div>
        <div
          ref={shadowRef}
          className="absolute left-1/2"
          style={{
            bottom: -28,
            width: S * 1.6,
            height: 22,
            background: "radial-gradient(ellipse, rgba(108,92,255,0.4) 0%, rgba(108,92,255,0.12) 40%, transparent 70%)",
            filter: "blur(8px)",
            borderRadius: "50%",
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={msgIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-[15px] font-bold"
          style={{ color: "var(--text-muted)" }}
        >
          {MESSAGES[msgIdx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function Face({ emoji, transform }: { emoji: string; transform: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-2xl"
      style={{
        transform,
        backfaceVisibility: "hidden",
        background: "linear-gradient(160deg, rgba(140,120,255,0.25) 0%, rgba(108,92,255,0.1) 50%, rgba(80,60,200,0.15) 100%)",
        borderTop: "1.5px solid rgba(180,165,255,0.5)",
        borderLeft: "1.5px solid rgba(160,145,255,0.35)",
        borderRight: "1.5px solid rgba(100,80,220,0.25)",
        borderBottom: "1.5px solid rgba(80,60,200,0.2)",
        boxShadow:
          "0 0 24px rgba(108,92,255,0.12), " +
          "inset 0 1px 1px rgba(200,190,255,0.2), " +
          "inset 0 -1px 1px rgba(60,40,160,0.15)",
      }}
    >
      <span className="text-[34px] select-none">{emoji}</span>
    </div>
  );
}
