import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  text: string;
}

export function ChatBubble({ onClick, hasRoute }: { onClick: () => void; hasRoute: boolean }) {
  if (!hasRoute) return null;
  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="absolute right-5 bottom-[195px] z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#6C5CFF] shadow-[0_4px_20px_rgba(108,92,255,0.5)] active:shadow-[0_2px_10px_rgba(108,92,255,0.3)]"
    >
      <MessageCircle size={22} className="text-white" />
    </motion.button>
  );
}

export function ChatPanel({
  open,
  onClose,
  messages,
  onSend,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 z-[100] flex flex-col justify-end bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 240 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[55%] flex-col rounded-t-[28px] border-t shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-[#6C5CFF]" />
                <h2 className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>探索助手</h2>
              </div>
              <button onClick={onClose} className="rounded-full p-1.5 active:scale-90" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-2 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40" style={{ color: "var(--text-secondary)" }}>
                  <MessageCircle size={32} />
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>跟我说说你想去哪、想吃什么、或者换个地方走走</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#6C5CFF] text-white rounded-br-md"
                        : msg.role === "system"
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-bl-md text-[12px] italic"
                        : "rounded-bl-md"
                    }`}
                    style={msg.role === "assistant" ? { backgroundColor: "var(--bg-input)", color: "var(--text-primary)" } : undefined}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 rounded-bl-md" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-[12px]">思考中...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-4 pb-5 pt-2">
              <div className="flex items-center gap-2 rounded-2xl border px-3 py-2" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-input)" }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="换个地方走走..."
                  className="flex-1 bg-transparent text-[14px] outline-none placeholder:opacity-40"
                  style={{ color: "var(--text-primary)" }}
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                    input.trim() && !loading ? "bg-[#6C5CFF] text-white" : "text-white/20"
                  }`}
                  style={!input.trim() || loading ? { backgroundColor: "var(--bg-input)", color: "var(--text-faint)" } : undefined}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
