import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Minimize2, RotateCcw, ChevronDown } from "lucide-react";

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const CHIPS = [
  { label: "ما هو هذا الموقع؟", emoji: "🌐" },
  { label: "كيف أرسل كليب؟", emoji: "📤" },
  { label: "كيف أشاهد الكليبات؟", emoji: "🎬" },
  { label: "كيف أرسم في المنصة؟", emoji: "🎨" },
  { label: "ما هو مجتمع المقترحات؟", emoji: "🏘️" },
  { label: "كيف أصبح رسام دريم؟", emoji: "⭐" },
];

function Dots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-purple-400"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";

  const renderText = (text: string) => {
    return text.split("\n").map((line, li, arr) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={li}>
          {parts.map((p, pi) =>
            p.startsWith("**") && p.endsWith("**") ? (
              <strong key={pi} style={{ color: "#c084fc", fontWeight: 700 }}>
                {p.slice(2, -2)}
              </strong>
            ) : (
              p
            )
          )}
          {li < arr.length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      style={{ display: "flex", gap: "10px", flexDirection: isUser ? "row-reverse" : "row" }}
    >
      <div
        style={{
          width: 28, height: 28, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
          background: isUser ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg,#7c3aed,#ec4899)",
          border: isUser ? "1px solid rgba(255,255,255,0.1)" : "none",
          fontSize: 14,
        }}
      >
        {isUser ? "👤" : <Sparkles size={14} color="white" />}
      </div>
      <div
        style={{
          maxWidth: "80%", padding: "10px 14px", borderRadius: 16, fontSize: 13, lineHeight: 1.6,
          borderTopRightRadius: isUser ? 4 : 16,
          borderTopLeftRadius: isUser ? 16 : 4,
          background: isUser
            ? "linear-gradient(135deg,rgba(124,58,237,0.8),rgba(236,72,153,0.8))"
            : "rgba(255,255,255,0.05)",
          border: isUser
            ? "1px solid rgba(168,85,247,0.3)"
            : "1px solid rgba(255,255,255,0.08)",
          color: isUser ? "white" : "rgba(255,255,255,0.85)",
        }}
        dir="rtl"
      >
        {renderText(msg.text)}
      </div>
    </motion.div>
  );
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);
  const [chips, setChips] = useState(true);
  const [pulse, setPulse] = useState(true);

  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    if (!open && msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
      setUnread((n) => n + 1);
    }
  }, [msgs]); // eslint-disable-line

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        id: "w",
        role: "assistant",
        text: "مرحباً بك! 👋\n\nأنا **سبارك** — مساعدك الذكي في **StreamerClipHub**.\n\nيمكنني مساعدتك في:\n• شرح الموقع وكيفية استخدامه\n• إرسال ومشاهدة الكليبات\n• قسم الرسم والرسامين\n• أي سؤال تريده! 🚀",
      }]);
    }
  }, [open]); // eslint-disable-line

  const openFn = () => {
    setOpen(true);
    setMini(false);
    setUnread(0);
    setPulse(false);
    setTimeout(() => taRef.current?.focus(), 300);
  };

  const closeFn = () => { setOpen(false); ctrl.current?.abort(); };
  const resetFn = () => { ctrl.current?.abort(); setMsgs([]); setChips(true); setInput(""); setBusy(false); };

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || busy) return;
      setChips(false);
      setInput("");
      setBusy(true);
      const um: Msg = { id: uid(), role: "user", text: t };
      setMsgs((prev) => [...prev, um]);
      const history = [...msgs, um].map((m) => ({ role: m.role, content: m.text }));
      try {
        ctrl.current = new AbortController();
        const res = await fetch("/api/ai-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: ctrl.current.signal,
        });
        if (!res.ok) throw new Error("err");
        const data = await res.json() as { reply?: string };
        setMsgs((prev) => [...prev, { id: uid(), role: "assistant", text: data.reply ?? "عذراً، لم أتمكن من الرد." }]);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        setMsgs((prev) => [...prev, { id: uid(), role: "assistant", text: "⚠️ حدث خطأ في الاتصال. حاول مجدداً." }]);
      } finally {
        setBusy(false);
      }
    },
    [msgs, busy]
  );

  const onKey = (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  // ── styles ───────────────────────────────────────────────────
  const S = {
    window: {
      position: "fixed" as const, bottom: 24, left: 24, zIndex: 900,
      width: 360, maxWidth: "calc(100vw - 24px)",
      background: "#0d0d1a",
      borderRadius: 24,
      overflow: "hidden",
      boxShadow: "0 0 80px rgba(0,0,0,0.8),0 0 0 1px rgba(255,255,255,0.07)",
    },
    header: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px",
      background: "linear-gradient(135deg,rgba(124,58,237,0.25),rgba(236,72,153,0.2))",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      cursor: "pointer",
      userSelect: "none" as const,
    },
    iconBtn: {
      width: 28, height: 28, borderRadius: 8, display: "flex",
      alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer",
    } as React.CSSProperties,
    msgs: {
      height: 380, overflowY: "auto" as const,
      padding: "16px", display: "flex", flexDirection: "column" as const, gap: 12,
    },
    inputWrap: {
      display: "flex", alignItems: "flex-end", gap: 8,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 16, padding: "8px 12px",
    },
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.div
            style={{ position: "fixed", bottom: 24, left: 24, zIndex: 900 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
          >
            {pulse && [1, 2].map((i) => (
              <motion.div
                key={i}
                style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(168,85,247,0.4)" }}
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2 + i * 0.5, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
              />
            ))}
            <motion.button
              onClick={openFn}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              style={{
                position: "relative", width: 56, height: 56, borderRadius: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                boxShadow: "0 0 30px rgba(168,85,247,0.5)",
                border: "none", cursor: "pointer",
              }}
            >
              <Sparkles size={24} color="white" />
              <AnimatePresence>
                {unread > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    style={{
                      position: "absolute", top: -6, right: -6,
                      width: 20, height: 20, borderRadius: "50%",
                      background: "#ef4444", color: "white", fontSize: 10,
                      fontWeight: 900, display: "flex", alignItems: "center",
                      justifyContent: "center", border: "2px solid #06060f",
                    }}
                  >
                    {unread}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <motion.div
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.5 }}
              style={{
                position: "absolute", left: 64, top: "50%", transform: "translateY(-50%)",
                whiteSpace: "nowrap", background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, padding: "6px 12px", fontSize: 12,
                color: "rgba(255,255,255,0.7)", pointerEvents: "none",
              }}
              dir="rtl"
            >
              تحدث مع المساعد الذكي ✨
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            style={S.window}
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.92 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
          >
            {/* Header */}
            <div style={S.header} onClick={() => mini && setMini(false)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles size={16} color="white" />
                </div>
                <div dir="rtl">
                  <p style={{ color: "white", fontWeight: 700, fontSize: 14, margin: 0 }}>سبارك AI</p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse 2s infinite" }} />
                    مساعدك الذكي · دائماً متاح
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={S.iconBtn} onClick={(e) => { e.stopPropagation(); resetFn(); }} title="محادثة جديدة">
                  <RotateCcw size={14} />
                </button>
                <button style={S.iconBtn} onClick={(e) => { e.stopPropagation(); setMini((m) => !m); }}>
                  {mini ? <ChevronDown size={14} /> : <Minimize2 size={14} />}
                </button>
                <button style={{ ...S.iconBtn, color: "rgba(255,255,255,0.35)" }} onClick={closeFn}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {!mini && (
              <>
                {/* Messages */}
                <div style={S.msgs}>
                  <AnimatePresence initial={false}>
                    {msgs.map((m) => <Bubble key={m.id} msg={m} />)}
                  </AnimatePresence>
                  <AnimatePresence>
                    {busy && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 10, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                        }}>
                          <Sparkles size={14} color="white" />
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, borderTopLeftRadius: 4 }}>
                          <Dots />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={endRef} />
                </div>

                {/* Chips */}
                <AnimatePresence>
                  {chips && msgs.length <= 1 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      style={{ padding: "8px 16px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "right", margin: "0 0 8px" }}>أسئلة شائعة:</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                        {CHIPS.map((c) => (
                          <button
                            key={c.label}
                            onClick={() => send(c.label)}
                            dir="rtl"
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "4px 10px", borderRadius: 10, fontSize: 11, cursor: "pointer",
                              border: "1px solid rgba(255,255,255,0.1)",
                              background: "rgba(255,255,255,0.04)",
                              color: "rgba(255,255,255,0.6)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "rgba(168,85,247,0.4)";
                              e.currentTarget.style.background = "rgba(168,85,247,0.1)";
                              e.currentTarget.style.color = "white";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                              e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                            }}
                          >
                            <span>{c.emoji}</span><span>{c.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input */}
                <div style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={S.inputWrap}>
                    <textarea
                      ref={taRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
                      }}
                      onKeyDown={onKey}
                      placeholder="اكتب سؤالك هنا..."
                      dir="rtl"
                      rows={1}
                      disabled={busy}
                      style={{
                        flex: 1, background: "transparent", border: "none", outline: "none",
                        color: "white", fontSize: 13, resize: "none", minHeight: 24, maxHeight: 96,
                        fontFamily: "inherit", caretColor: "#a855f7",
                      }}
                    />
                    <motion.button
                      onClick={() => send(input)}
                      disabled={!input.trim() || busy}
                      whileTap={{ scale: 0.9 }}
                      style={{
                        width: 32, height: 32, borderRadius: 10, flexShrink: 0, border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: input.trim() && !busy ? "linear-gradient(135deg,#7c3aed,#ec4899)" : "rgba(255,255,255,0.06)",
                        opacity: !input.trim() || busy ? 0.4 : 1,
                      }}
                    >
                      <Send size={14} color="white" />
                    </motion.button>
                  </div>
                  <p style={{ textAlign: "center", marginTop: 6, fontSize: 9, color: "rgba(255,255,255,0.15)" }}>
                    مدعوم بـ Claude AI · StreamerClipHub
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
