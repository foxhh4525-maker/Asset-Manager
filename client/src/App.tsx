import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, Gamepad2 } from "lucide-react";
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
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

function LoadingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#06060f] overflow-hidden"
    >
      <div className="absolute inset-0">
        {[...Array(15)].map((_, i) => (
          <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-purple-500/40"
            style={{ left: `${(i * 7 + 5) % 100}%`, top: `${(i * 13 + 10) % 100}%` }}
            animate={{ y: [-15, 15], opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <div className="absolute w-64 h-64 rounded-full border border-purple-500/10 animate-pulse" />
      <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
        className="relative mb-5">
        <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-40 scale-150" />
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.6)]">
          <Gamepad2 className="w-10 h-10 text-white" />
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center">
        <h1 className="text-3xl font-black text-white mb-1">Streamer<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Clip</span>Hub</h1>
        <p className="text-white/40 text-sm">جاري التحميل...</p>
      </motion.div>
      <motion.div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600"
        initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.8, ease: "easeInOut" }} />
    </motion.div>
  );
}

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
    reader.onload = e => { setAvatar(e.target?.result as string); setError(""); };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const n = name.trim();
    if (n.length < 2) { setError("الاسم يجب أن يكون حرفين على الأقل"); return; }
    setSaving(true);
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
            <button onClick={() => fileInputRef.current?.click()} className="relative group">
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

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useUser();
  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[#06060f]"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;
  if (!user || user.role !== "admin") return <Redirect to="/" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/submit" component={SubmitPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/dream-artists" component={DreamArtists} />
      <Route path="/draw" component={DrawPage} />
      <Route path="/studio"><AdminRoute component={Studio} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { identity } = useIdentity();
  const [phase, setPhase] = useState<"loading" | "identity" | "ready">("loading");

  const afterLoading = () => {
    try {
      const done = localStorage.getItem("sc_identity_done");
      if (!identity && !done) { setPhase("identity"); }
      else { setPhase("ready"); }
    } catch { setPhase("ready"); }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AnimatePresence mode="wait">
          {phase === "loading" && <LoadingScreen key="loading" onDone={afterLoading} />}
          {phase === "identity" && <IdentityWall key="identity" onDone={() => setPhase("ready")} />}
        </AnimatePresence>
        {phase === "ready" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
            <Router />
          </motion.div>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
