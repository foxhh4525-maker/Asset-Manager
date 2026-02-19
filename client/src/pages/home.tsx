import { useState, useCallback, useEffect } from "react";
import { Layout } from "@/components/layout";
import { ClipCard } from "@/components/clip-card";
import { useClips } from "@/hooks/use-clips";
import { useUser } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Clock, Trophy, Loader2, X, ExternalLink, Play, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────
//  بناء رابط الـ Embed من بيانات videoId + timestamps
// ─────────────────────────────────────────────────────────────
function buildEmbedUrl(videoId: string, startTime = 0, endTime = 0): string {
  const p = new URLSearchParams({
    autoplay:       "1",
    rel:            "0",
    modestbranding: "1",
    start:          String(startTime),
    enablejsapi:    "0",
    iv_load_policy: "3",
    color:          "white",
  });
  if (endTime > 0) p.set("end", String(endTime));
  return `https://www.youtube-nocookie.com/embed/${videoId}?${p}`;
}

function resolveYouTubeEmbedUrl(clip: any): string | null {
  const url = clip.url || "";

  if (/youtube(-nocookie)?\.com\/embed\//i.test(url)) {
    try {
      const u = new URL(url);
      u.searchParams.set("autoplay", "1");
      u.searchParams.set("rel", "0");
      return u.toString().replace("www.youtube.com/embed", "www.youtube-nocookie.com/embed");
    } catch { return url; }
  }

  if (/youtube\.com\/clip\//i.test(url)) {
    if (clip.videoId) {
      const clipId = url.match(/\/clip\/([A-Za-z0-9_-]+)/)?.[1];
      if (clipId) return `https://www.youtube-nocookie.com/embed/${clip.videoId}?clip=${clipId}&autoplay=1&rel=0`;
    }
    return null;
  }

  const videoId   = clip.videoId   || extractFromUrl(url).videoId;
  const startTime = clip.startTime ?? extractFromUrl(url).startTime;
  const endTime   = clip.endTime   ?? extractFromUrl(url).endTime;

  if (videoId) return buildEmbedUrl(videoId, startTime, endTime);
  return null;
}

function extractFromUrl(url: string): { videoId: string | null; startTime: number; endTime: number } {
  if (!url) return { videoId: null, startTime: 0, endTime: 0 };
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v) return {
      videoId: v,
      startTime: parseInt(u.searchParams.get("start") ?? "0") || 0,
      endTime:   parseInt(u.searchParams.get("end")   ?? "0") || 0,
    };
    const short = url.match(/youtu\.be\/([\w-]{11})/);
    if (short) return { videoId: short[1], startTime: 0, endTime: 0 };
    const local = url.match(/\/([a-zA-Z0-9_-]{11})_(\d+)-(\d+)\.mp4$/);
    if (local) return { videoId: local[1], startTime: +local[2], endTime: +local[3] };
  } catch {}
  return { videoId: null, startTime: 0, endTime: 0 };
}

// ─────────────────────────────────────────────────────────────
//  مشغّل Kick
// ─────────────────────────────────────────────────────────────
function extractKickClipId(clip: any): string {
  let clipId = clip.videoId || "";
  if (!clipId && clip.url) {
    const patterns = [
      /kick\.com\/clip\/([A-Za-z0-9_-]+)/i,
      /kick\.com\/[^/]+\/clips?\/([A-Za-z0-9_-]+)/i,
      /kick\.com\/clips\/([A-Za-z0-9_-]+)/i,
    ];
    for (const p of patterns) {
      const m = clip.url.match(p);
      if (m?.[1]) { clipId = m[1]; break; }
    }
  }
  return clipId;
}

const TAG_LABELS: Record<string, string> = {
  Funny: "😂 مضحك", Epic: "⚡ ملحمي",
  Glitch: "🐛 باج", Skill: "🎯 مهارة", Horror: "👻 مرعب",
};

// ─────────────────────────────────────────────────────────────
//  Modal Wrapper مشترك
// ─────────────────────────────────────────────────────────────
function PlayerModal({ clip, onClose, accentColor, children }: {
  clip: any; onClose: () => void; accentColor: string; children: React.ReactNode;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
    >
      {/* Backdrop blur effect */}
      <div className="absolute inset-0 backdrop-blur-md" />

      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="relative w-full max-w-5xl z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor }} />
            <span className="text-white/50 text-sm">يتم التشغيل الآن</span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            <X className="w-4 h-4" />
            <span>إغلاق</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 font-mono">ESC</kbd>
          </button>
        </div>

        {/* Player card */}
        <div
          className="relative rounded-2xl overflow-hidden bg-[#0a0a0a]"
          style={{ boxShadow: `0 0 80px -20px ${accentColor}, 0 0 0 1px rgba(255,255,255,0.07)` }}
        >
          {children}

          {/* Info bar */}
          <div className="px-5 py-4 bg-gradient-to-r from-black/80 to-black/60 border-t border-white/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white leading-tight mb-1 truncate">{clip.title}</h2>
                <div className="flex items-center gap-2 text-xs text-white/50 flex-wrap">
                  <span>بواسطة</span>
                  <span className="text-white/80 font-medium">{clip.submitterName || clip.submitter?.username || "زائر"}</span>
                  {clip.tag && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span style={{ color: accentColor }}>{TAG_LABELS[clip.tag] ?? clip.tag}</span>
                    </>
                  )}
                </div>
              </div>
              <a
                href={clip.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                فتح خارجياً
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
//  مشغّل Kick
// ─────────────────────────────────────────────────────────────
function KickGhostPlayer({ clip, onClose }: { clip: any; onClose: () => void }) {
  const clipId    = extractKickClipId(clip);
  const directUrl = clip.url?.startsWith("http")
    ? clip.url
    : (clipId ? `https://kick.com/clips/${clipId}` : "https://kick.com");

  return (
    <PlayerModal clip={clip} onClose={onClose} accentColor="#53FC1F">
      <div className="aspect-video w-full relative bg-[#050505] flex items-center justify-center overflow-hidden">
        {clip.thumbnailUrl && (
          <>
            <img src={clip.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-lg scale-110" />
            <img src={clip.thumbnailUrl} alt={clip.title} className="relative z-10 h-full w-auto max-w-full object-contain" />
          </>
        )}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(83,252,31,0.1)", border: "2px solid rgba(83,252,31,0.35)", boxShadow: "0 0 40px rgba(83,252,31,0.25)" }}>
            <svg viewBox="0 0 32 32" className="w-11 h-11" fill="#53FC1F">
              <path d="M4 4h6v10l8-10h8L16 16l10 12h-8L10 18v10H4V4z"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white/70 text-sm mb-1">كليبات Kick تُشاهد مباشرةً على المنصة</p>
            <p className="text-white/40 text-xs">اضغط الزر لفتح الكليب في Kick</p>
          </div>
          <a href={directUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2.5 font-bold px-8 py-3.5 rounded-xl text-black transition-all"
            style={{ background: "#53FC1F", boxShadow: "0 0 30px rgba(83,252,31,0.5)" }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-black"><path d="M8 5v14l11-7z"/></svg>
            شاهد على Kick
            <ExternalLink className="w-4 h-4 opacity-70" />
          </a>
        </div>
      </div>
    </PlayerModal>
  );
}

// ─────────────────────────────────────────────────────────────
//  مشغّل YouTube Clips
// ─────────────────────────────────────────────────────────────
function YouTubeClipPlayer({ clip, onClose }: { clip: any; onClose: () => void }) {
  const directUrl = clip.url?.startsWith("http") ? clip.url : "https://youtube.com";

  return (
    <PlayerModal clip={clip} onClose={onClose} accentColor="#ef4444">
      <div className="aspect-video w-full relative bg-[#050505] flex items-center justify-center overflow-hidden">
        {clip.thumbnailUrl && (
          <>
            <img src={clip.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-lg scale-110" />
            <img src={clip.thumbnailUrl} alt={clip.title} className="relative z-10 h-full w-auto max-w-full object-contain" />
          </>
        )}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.35)", boxShadow: "0 0 40px rgba(239,68,68,0.25)" }}>
            <svg viewBox="0 0 90 63" className="w-11 h-8 fill-red-600">
              <path d="M88.1 9.9C87 5.7 83.8 2.5 79.7 1.4 72.7 0 45 0 45 0S17.3 0 10.3 1.4C6.2 2.5 3 5.7 1.9 9.9 0 16.4 0 31.5 0 31.5s0 15.1 1.9 21.6c1.1 4.2 4.3 7.4 8.4 8.5C17.3 63 45 63 45 63s27.7 0 34.7-1.4c4.1-1.1 7.3-4.3 8.4-8.5C90 46.6 90 31.5 90 31.5s0-15.1-1.9-21.6z"/>
              <path d="M36 45l23.3-13.5L36 18z" fill="white"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white/70 text-sm mb-1">كليبات YouTube تُشاهد مباشرةً على المنصة</p>
            <p className="text-white/40 text-xs">اضغط الزر لفتح الكليب في YouTube</p>
          </div>
          <a href={directUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2.5 font-bold px-8 py-3.5 rounded-xl text-white transition-all"
            style={{ background: "#dc2626", boxShadow: "0 0 30px rgba(239,68,68,0.5)" }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M8 5v14l11-7z"/></svg>
            شاهد على YouTube
            <ExternalLink className="w-4 h-4 opacity-70" />
          </a>
        </div>
      </div>
    </PlayerModal>
  );
}

// ─────────────────────────────────────────────────────────────
//  Fallback Player
// ─────────────────────────────────────────────────────────────
function FallbackPlayer({ clip }: { clip: any }) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [failed,   setFailed]   = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true); setFailed(false); setEmbedUrl(null);
    fetch(`/api/resolve-url?url=${encodeURIComponent(clip.url)}`)
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.embedUrl) setEmbedUrl(d.embedUrl);
        else if (d.videoId) setEmbedUrl(buildEmbedUrl(d.videoId, d.startTime || 0, d.endTime || 0));
        else setFailed(true);
      })
      .catch(() => { setLoading(false); setFailed(true); });
  }, [clip.url]);

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-black aspect-video">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-white/50 text-sm">جاري تحميل الكليب...</p>
      </div>
    </div>
  );

  if (failed || !embedUrl) return (
    <div className="flex flex-col items-center justify-center aspect-video gap-4 bg-black text-white p-6">
      {clip.thumbnailUrl && <img src={clip.thumbnailUrl} alt={clip.title} className="max-h-32 rounded-xl opacity-60" />}
      <p className="text-white/60 text-sm text-center">لا يمكن تشغيل هذا الفيديو مباشرةً</p>
      <a href={clip.url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all">
        <ExternalLink className="w-4 h-4" />
        افتح على YouTube
      </a>
    </div>
  );

  return (
    <iframe src={embedUrl} className="w-full aspect-video border-0"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen title={clip.title} />
  );
}

// ─────────────────────────────────────────────────────────────
//  المشغّل الرئيسي
// ─────────────────────────────────────────────────────────────
function GhostPlayer({ clip, onClose }: { clip: any; onClose: () => void }) {
  const isKick   = clip.platform === "kick" || /kick\.com/i.test(clip.url || "");
  const isYTClip = /youtube\.com\/clip\//i.test(clip.url || "");

  if (isKick)   return <KickGhostPlayer   clip={clip} onClose={onClose} />;
  if (isYTClip) return <YouTubeClipPlayer clip={clip} onClose={onClose} />;

  const embedUrl = resolveYouTubeEmbedUrl(clip);

  return (
    <PlayerModal clip={clip} onClose={onClose} accentColor="rgba(168,85,247,0.8)">
      {embedUrl ? (
        <iframe
          key={clip.id}
          src={embedUrl}
          className="w-full aspect-video border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          title={clip.title}
        />
      ) : (
        <FallbackPlayer clip={clip} />
      )}
    </PlayerModal>
  );
}

// ─────────────────────────────────────────────────────────────
//  Skeleton Card
// ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-[#0d0d10] rounded-2xl overflow-hidden border border-white/5">
      <div className="aspect-video bg-white/5 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-white/5 rounded-lg animate-pulse" />
        <div className="h-3 bg-white/5 rounded-lg animate-pulse w-2/3" />
        <div className="h-0.5 bg-white/5 rounded animate-pulse" />
        <div className="flex justify-between">
          <div className="h-7 bg-white/5 rounded-lg animate-pulse w-24" />
          <div className="h-7 bg-white/5 rounded-lg animate-pulse w-16" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  الصفحة الرئيسية
// ─────────────────────────────────────────────────────────────
export default function Home() {
  const [sortBy, setSortBy]         = useState<"new" | "top">("new");
  const [selectedClip, setSelected] = useState<any>(null);
  const { data: user } = useUser();
  const isAdmin = user?.role === "admin";

  const { data: clips, isLoading, error } = useClips({ status: "approved", sort: sortBy });

  const openClip  = useCallback((clip: any) => setSelected(clip), []);
  const closeClip = useCallback(() => setSelected(null), []);

  return (
    <Layout>

      {/* ─── Hero ────────────────────────────────────────────── */}
      <div className="relative mb-10 rounded-2xl overflow-hidden border border-white/5 p-8 md:p-12"
        style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(6,182,212,0.04) 50%, rgba(9,9,11,0) 100%)" }}>

        {/* خلفية ضوئية */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)", transform: "translate(-20%, 30%)" }} />

        <div className="relative z-10 max-w-2xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium mb-5"
            style={{ background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.25)", color: "hsl(265,89%,75%)" }}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>مسابقة أفضل المقاطع الأسبوعية مستمرة!</span>
          </motion.div>

          {/* العنوان الرئيسي */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-display font-extrabold tracking-tight mb-4 leading-tight"
          >
            اكتشف اللحظات{" "}
            <span className="relative">
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(135deg, hsl(265,89%,72%), hsl(190,90%,55%))" }}>
                الملحمية
              </span>
              <span className="absolute -bottom-1 left-0 right-0 h-px opacity-50"
                style={{ background: "linear-gradient(to right, hsl(265,89%,66%), transparent)" }} />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-base text-muted-foreground leading-relaxed"
          >
            أفضل المقاطع من المجتمع، يتم تصنيفها من قبلك. أرسل مقاطعك، صوّت على الآخرين، وتسلق لوحة الترتيب.
          </motion.p>
        </div>
      </div>

      {/* ─── Controls ───────────────────────────────────────── */}
      <div className="mb-7 flex items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl border border-white/8 bg-card/50">
          {[
            { value: "new", icon: Clock, label: "الأحدث" },
            { value: "top", icon: Flame, label: "الأعلى تقييماً" },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setSortBy(value as any)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                color: sortBy === value ? "white" : "hsl(var(--muted-foreground))",
                background: sortBy === value ? "hsl(var(--primary))" : "transparent",
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {clips && !isLoading && (
          <span className="text-sm text-muted-foreground ml-auto">
            {clips.length} مقطع
          </span>
        )}
      </div>

      {/* ─── Grid ───────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 text-destructive"
          >
            فشل في تحميل المقاطع.
          </motion.div>
        ) : clips?.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 space-y-3"
          >
            <div className="text-5xl mb-4">🎮</div>
            <p className="text-lg font-semibold text-foreground/80">لا توجد مقاطع بعد</p>
            <p className="text-sm text-muted-foreground">كن الأول وأرسل مقطعك!</p>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {clips?.map((clip: any, i: number) => (
              <motion.div
                key={clip.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <ClipCard clip={clip} onPlay={() => openClip(clip)} isAdmin={isAdmin} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Player Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {selectedClip && <GhostPlayer clip={selectedClip} onClose={closeClip} />}
      </AnimatePresence>
    </Layout>
  );
}
