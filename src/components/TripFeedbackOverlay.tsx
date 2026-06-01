import { useEffect, useState } from "react";
import { motion } from "motion/react";

const REACTIONS = [
  { emoji: "🤩", hint: "超棒" },
  { emoji: "😎", hint: "还行" },
  { emoji: "😐", hint: "一般" },
  { emoji: "😩", hint: "太累" },
  { emoji: "💀", hint: "别了" },
  { emoji: "💸", hint: "太贵" },
];

const AUTO_DISMISS_MS = 5000;

export function TripFeedbackOverlay({
  onReact,
  onDismiss,
}: {
  onReact: (emoji: string) => void;
  onDismiss: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handlePick = (emoji: string) => {
    setPicked(emoji);
    setTimeout(() => onReact(emoji), 350);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[160] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="mx-8 w-full max-w-[340px] rounded-3xl border p-6 text-center backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,.5)]"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
      >
        <p className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>
          跟我吐槽一下
        </p>
        <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
          这次的路线怎么样？
        </p>

        <div className="mt-5 flex justify-center gap-3">
          {REACTIONS.map(({ emoji, hint }) => (
            <motion.button
              key={emoji}
              whileTap={{ scale: 0.85 }}
              animate={picked === emoji ? { scale: 1.3, y: -6 } : picked ? { scale: 0.7, opacity: 0.3 } : {}}
              onClick={() => !picked && handlePick(emoji)}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[32px] leading-none">{emoji}</span>
              <span className="text-[10px] font-bold" style={{ color: "var(--text-faint)" }}>{hint}</span>
            </motion.button>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="mt-5 text-[12px] font-bold"
          style={{ color: "var(--text-faint)" }}
        >
          跳过
        </button>
      </motion.div>
    </motion.div>
  );
}
