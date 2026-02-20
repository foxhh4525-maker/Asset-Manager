import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, Gamepad2, Zap } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SubmitPage from "@/pages/submit";
import Dashboard from "@/pages/dashboard";
import Studio from "@/pages/Studio";
import AdminLogin from "@/pages/admin-login";
import DrawPage from "@/pages/DrawPage";
import DreamArtists from "@/pages/DreamArtists";
import { useUser } from "@/hooks/use-auth";
import { useIdentity } from "@/hooks/use-identity";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { sfx } from "@/lib/sounds";
import { AIAssistant } from "@/components/AIAssistant";

// ─── Loading Screen ──────────────────────────────────────────
function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase]       = useState(0);

  const PHASES = ["تحميل الموارد...", "بناء الواجهة...", "جاهز! 🚀"];

  useEffect(() => {
    // Progress animation
    const steps = [
      { target: 30,  delay: 0    },
      { target: 65,  delay: 400  },
      { target: 88,  delay: 900  },
      { target: 100, delay: 1400 },
    ];
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach(({ target, delay }) => {
      timers.push(setTimeout(() => setProgress(target), delay));
    });

    // Phase text
    timers.push(setTimeout(() => setPhase(1), 500));
    timers.push(setTimeout(() => setPhase(2), 1200));
    timers.push(setTimeout(() => onDone(),    1800));

    // Play startup sound
    setTimeout(() => sfx.open(), 300);

    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  const particles = Array.from({ length: 20 }, (_, i) => ({
    x: (i * 17 + 7) % 100,
    y: (i * 23 + 5) % 100,
    size: 1 + (i % 3),
    delay: i * 0.08,
    dur: 1.8 + (i % 4) * 0.4,
  }));

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#06060f] overflow-hidden"
    >
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/3 w-72 h-72 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)" }}
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </div>

      {/* Particles */}
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left:   `${p.x}%`,
            top:    `${p.y}%`,
            width:  p.size,
            height: p.size,
            background: i % 3 === 0 ? "#a855f7" : i % 3 === 1 ? "#ec4899" : "#818cf8",
          }}
          animate={{ y: [-20, 20, -20], opacity: [0.1, 0.6, 0.1], scale: [0.8, 1.4, 0.8] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Rotating rings */}
      <div className="absolute">
        <motion.div
          className="w-48 h-48 rounded-full border border-purple-500/15"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-4 rounded-full border border-pink-500/10"
          animate={{ rotate: -360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ scale: 0, rotate: -180, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 180, delay: 0.1 }}
        className="relative mb-7 z-10"
      >
        <motion.div
          className="absolute inset-0 rounded-3xl blur-2xl"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.7), rgba(236,72,153,0.7))" }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center shadow-[0_0_60px_rgba(168,85,247,0.7)]"
          style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
          <Gamepad2 className="w-12 h-12 text-white drop-shadow" />

          {/* Orbiting element */}
          <motion.div
            className="absolute w-4 h-4 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)]"
            style={{ top: -6, right: -6 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-center z-10 mb-8"
      >
        <h1 className="text-4xl font-black text-white mb-1.5 tracking-tight">
          Streamer
          <motion.span
            className="text-transparent bg-clip-text"
            style={{ backgroundImage: "linear-gradient(to right, #a855f7, #ec4899, #a855f7)", backgroundSize: "200%" }}
            animate={{ backgroundPosition: ["0%", "100%", "0%"] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            Clip
          </motion.span>
          Hub
        </h1>
        <motion.p
          className="text-white/50 text-sm font-medium"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {PHASES[phase]}
        </motion.p>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="z-10 w-52"
      >
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(to right, #7c3aed, #ec4899)" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-white/20 text-[10px] font-mono">{progress}%</span>
          <Zap className="w-3 h-3 text-purple-500/50" />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Identity Wall ─────────────────────────────────────────────
function IdentityWall({ onDone }: { onDone: () => void }) {
  const { setIdentity } = useIdentity();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { setError("يجب أن يكون ملف صورة"); return; }
    if (file.size > 3 * 1024 * 1024) { setError("الصورة أكبر من 3MB"); return; }
    const reader = new FileReader();
    reader.onload = e => { setAvatar(e.target?.result as string); setError(""); sfx.click(); };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const n = name.trim();
    if (n.length < 2) { setError("الاسم يجب أن يكون حرفين على الأقل"); sfx.error(); return; }
    setSaving(true);
    sfx.success();
    setIdentity({ name: n, customAvatar: avatar });
    try { localStorage.setItem("sc_identity_done", "1"); } catch {}
    await new Promise(r => setTimeout(r, 350));
    onDone();
  };

  const avatarHue = name ? ((name.charCodeAt(0) * 53) % 360) : 270;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[998] flex items-center justify-center bg-[#06060f] p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-purple-600/8 blur-[100px] rounded-full" />
        <div className="absolute bottom-1/3 right-1/4 w-60 h-60 bg-pink-600/8 blur-[80px] rounded-full" />
      </div>
      <motion.div initial={{ scale: 0.88, opacity: 0, y: 25 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 220, delay: 0.05 }}
        className="relative w-full max-w-sm">
        <div className="bg-[#0e0e1a] border border-white/8 rounded-3xl p-8 shadow-[0_0_80px_rgba(168,85,247,0.12)]">
          <div className="text-center mb-6">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 items-center justify-center mb-3 shadow-[0_0_25px_rgba(168,85,247,0.4)]">
              <span className="text-2xl">👋</span>
            </div>
            <h2 className="text-2xl font-black text-white mb-1">أهلاً بك!</h2>
            <p className="text-white/45 text-sm">أدخل اسمك لتبدأ المتعة</p>
          </div>

          <div className="flex justify-center mb-5">
            <button onClick={() => { fileInputRef.current?.click(); sfx.click(); }} className="relative group">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white overflow-hidden border-2 border-white/10 group-hover:border-purple-500/60 transition-all"
                style={{ background: avatar ? "transparent" : `hsl(${avatarHue},55%,32%)` }}>
                {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (name[0]?.toUpperCase() || "؟")}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center border-2 border-[#0e0e1a] text-[10px]">📷</div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          </div>

          <div className="mb-5">
            <label className="block text-white/50 text-xs mb-2 font-medium">اسمك في المنصة</label>
            <input value={name} onChange={e => { setName(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && save()}
              placeholder="اكتب اسمك هنا..." maxLength={30} dir="rtl" autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-purple-500/50 transition-all" />
            {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
          </div>

          <motion.button whileTap={{ scale: 0.97 }} onClick={save}
            disabled={saving || name.trim().length < 2}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 shadow-[0_0_25px_rgba(168,85,247,0.3)] hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>ابدأ الاستمتاع</span><span>🚀</span></>}
          </motion.button>
          <p className="text-white/20 text-xs text-center mt-3">يمكنك تغيير هويتك لاحقاً</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Admin Route ──────────────────────────────────────────────
// FIX: لا نعيد التوجيه هنا لأن Studio لديه check خاص بها
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useUser();
  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#06060f]">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent"
        />
        <p className="text-white/30 text-sm">التحقق من الصلاحيات...</p>
      </div>
    </div>
  );
  // Let the component handle unauthorized state to avoid double redirect
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/"              component={Home} />
      <Route path="/submit"        component={SubmitPage} />
      <Route path="/dashboard"     component={Dashboard} />
      <Route path="/admin-login"   component={AdminLogin} />
      <Route path="/dream-artists" component={DreamArtists} />
      <Route path="/draw"          component={DrawPage} />
      <Route path="/studio"><AdminRoute component={Studio} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { identity } = useIdentity();
  const [phase, setPhase] = useState<"loading" | "identity" | "ready">("loading");

  const afterLoading = useCallback(() => {
    try {
      const done = localStorage.getItem("sc_identity_done");
      if (!identity && !done) { setPhase("identity"); }
      else { setPhase("ready"); }
    } catch { setPhase("ready"); }
  }, [identity]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AnimatePresence mode="wait">
          {phase === "loading"   && <LoadingScreen  key="loading"  onDone={afterLoading} />}
          {phase === "identity"  && <IdentityWall   key="identity" onDone={() => setPhase("ready")} />}
        </AnimatePresence>
        {phase === "ready" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
            <Router />
            <AIAssistant />
          </motion.div>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
