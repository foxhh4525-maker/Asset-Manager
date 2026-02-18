import { useState, useCallback } from "react";
import { Layout } from "@/components/layout";
import { ClipCard } from "@/components/clip-card";
import { useClips } from "@/hooks/use-clips";
import { useUser } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Clock, Trophy, Loader2, Play, X, Maximize2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────
//  بناء رابط الـ Embed من البيانات المحفوظة مسبقاً
// ─────────────────────────────────────────────────────────────
function buildEmbedUrl(videoId: string, startTime = 0, endTime = 0): string {
  const p = new URLSearchParams({
    autoplay:       "1",
    rel:            "0",
    modestbranding: "1",
    start:          String(startTime),
    enablejsapi:    "0",
    iv_load_policy: "3",  // إخفاء التعليقات التوضيحية
    color:          "white",
  });
  if (endTime > 0) p.set("end", String(endTime));
  // youtube-nocookie = بدون كوكيز + أسرع تحميل
  return `https://www.youtube-nocookie.com/embed/${videoId}?${p}`;
}

// استخراج من URL احتياطي (للكليبات القديمة بدون videoId مخزّن)
function extractFromUrl(url: string): { videoId: string | null; startTime: number; endTime: number } {
  if (!url) return { videoId: null, startTime: 0, endTime: 0 };
  try {
    // /api/videos/ID_start-end.mp4
    const local = url.match(/\/([a-zA-Z0-9_-]{11})_(\d+)-(\d+)\.mp4$/);
    if (local) return { videoId: local[1], startTime: +local[2], endTime: +local[3] };

    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v) return {
      videoId: v,
      startTime: parseInt(u.searchParams.get("start") ?? "0") || 0,
      endTime:   parseInt(u.searchParams.get("end")   ?? "0") || 0,
    };
    const short = url.match(/youtu\.be\/([\w-]{11})/);
    if (short) return { videoId: short[1], startTime: 0, endTime: 0 };
  } catch {}
  return { videoId: null, startTime: 0, endTime: 0 };
}

// ─────────────────────────────────────────────────────────────
//  مشغّل Kick — يجرّب الـ Embed أولاً، يظهر الزر عند الفشل
// ─────────────────────────────────────────────────────────────
function KickGhostPlayer({ clip, onClose }: { clip: any; onClose: () => void }) {
  const clipId  = clip.videoId || "";   // الـ slug المحفوظ في DB
  // ✅ رابط embed الصحيح لـ Kick
  const embedUrl = clipId ? `https://player.kick.com/clips/${clipId}` : null;
  const [iframeOk, setIframeOk] = useState<boolean | null>(embedUrl ? null : false);

  const TAG_LABELS: Record<string, string> = {
    Funny: "😂 مضحك", Epic: "⚡ ملحمي",
    Glitch: "🐛 باج",  Skill: "🎯 مهارة", Horror: "👻 مرعب",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 30 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="relative w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* زر الإغلاق */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
        >
          <X className="w-5 h-5" /> إغلاق
        </button>

        <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(83,252,31,0.15)] bg-black">
          <div className="aspect-video w-full">
            {/* ✅ جرّب الـ iframe أولاً */}
            {iframeOk !== false && embedUrl ? (
              <iframe
                key={clip.id}
                src={embedUrl}
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                title={clip.title}
                onLoad={() => setIframeOk(true)}
                onError={() => setIframeOk(false)}
              />
            ) : (
              /* Fallback — زر "شاهد على Kick" مضمون دائماً */
              <div className="flex flex-col items-center justify-center h-full gap-5 bg-black">
                {clip.thumbnailUrl && (
                  <img
                    src={clip.thumbnailUrl}
                    alt={clip.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-20"
                  />
                )}
                <div className="relative z-10 flex flex-col items-center gap-4">
                  {/* شعار Kick */}
                  <div className="w-16 h-16 rounded-2xl bg-[#53FC1F]/10 border border-[#53FC1F]/30 flex items-center justify-center">
                    <svg viewBox="0 0 32 32" className="w-9 h-9" fill="#53FC1F">
                      <path d="M4 4h6v10l8-10h8L16 16l10 12h-8L10 18v10H4V4z"/>
                    </svg>
                  </div>
                  <p className="text-white/60 text-sm">لا يمكن تشغيل الكليب مدمجاً</p>
                  <a
                    href={clip.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#53FC1F] hover:bg-[#45e018] text-black font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-[0_0_20px_rgba(83,252,31,0.4)]"
                  >
                    <ExternalLink className="w-4 h-4" />
                    شاهد على Kick ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* شريط معلومات الكليب */}
          <div className="bg-gradient-to-t from-black/90 to-black/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white leading-tight mb-1 line-clamp-1">
                  {clip.title}
                </h2>
                <div className="flex items-center gap-3 text-sm text-white/60">
                  <span>بواسطة <span className="text-white/80 font-medium">{clip.submitterName || clip.submitter?.username || "زائر"}</span></span>
                  {clip.tag && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      <span className="text-[#53FC1F] font-medium">{TAG_LABELS[clip.tag] ?? clip.tag}</span>
                    </>
                  )}
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span className="text-[#53FC1F]/70 text-xs font-semibold">Kick</span>
                </div>
              </div>
              <a
                href={clip.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/40 hover:text-[#53FC1F]/70 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Kick
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
//  مشغّل الشبح — يشغّل أي كليب داخل المنصة فورياً
// ─────────────────────────────────────────────────────────────
function GhostPlayer({ clip, onClose }: { clip: any; onClose: () => void }) {
  const isKick = clip.platform === "kick";

  // ── Kick Player ──────────────────────────────────────────
  if (isKick) {
    return (
      <KickGhostPlayer clip={clip} onClose={onClose} />
    );
  }

  // ── YouTube Player ───────────────────────────────────────
  const videoId   = clip.videoId   || extractFromUrl(clip.url).videoId;
  const startTime = clip.startTime ?? extractFromUrl(clip.url).startTime;
  const endTime   = clip.endTime   ?? extractFromUrl(clip.url).endTime;

  const embedUrl = videoId ? buildEmbedUrl(videoId, startTime, endTime) : null;

  const TAG_LABELS: Record<string, string> = {
    Funny:  "😂 مضحك",  Epic:   "⚡ ملحمي",
    Glitch: "🐛 باج",   Skill:  "🎯 مهارة",  Horror: "👻 مرعب",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 30 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="relative w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* زر الإغلاق */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
        >
          <X className="w-5 h-5" /> إغلاق
        </button>

        {/* ── مشغّل الفيديو ── */}
        <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(168,85,247,0.2)] bg-black">
          <div className="aspect-video w-full">
            {embedUrl ? (
              <iframe
                key={clip.id}
                src={embedUrl}
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                title={clip.title}
              />
            ) : (
              /* fallback: لا يوجد videoId أبداً → resolve من السيرفر */
              <FallbackPlayer clip={clip} />
            )}
          </div>

          {/* شريط معلومات الكليب */}
          <div className="bg-gradient-to-t from-black/90 to-black/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white leading-tight mb-1 line-clamp-1">
                  {clip.title}
                </h2>
                <div className="flex items-center gap-3 text-sm text-white/60">
                  <span>بواسطة <span className="text-white/80 font-medium">{clip.submitterName || clip.submitter?.username || "زائر"}</span></span>
                  {clip.tag && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      <span className="text-primary font-medium">{TAG_LABELS[clip.tag] ?? clip.tag}</span>
                    </>
                  )}
                  {startTime > 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      <span className="font-mono text-xs bg-white/10 px-2 py-0.5 rounded">
                        {Math.floor(startTime/60)}:{String(startTime%60).padStart(2,"0")}
                        {endTime > 0 && ` → ${Math.floor(endTime/60)}:${String(endTime%60).padStart(2,"0")}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {videoId && (
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}&t=${startTime}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> YouTube
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Fallback: يستدعي السيرفر لتحويل الرابط
function FallbackPlayer({ clip }: { clip: any }) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [failed,   setFailed]   = useState(false);

  useState(() => {
    fetch(`/api/resolve-url?url=${encodeURIComponent(clip.url)}`)
      .then(r => r.json())
      .then(d => {
        if (d.videoId) setEmbedUrl(buildEmbedUrl(d.videoId, d.startTime || 0, d.endTime || 0));
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  });

  if (failed) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 bg-black text-white">
      <p className="text-sm text-white/60">لا يمكن تشغيل هذا الكليب مباشرةً</p>
      <a href={clip.url} target="_blank" rel="noopener noreferrer"
        className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors">
        شاهد على YouTube ↗
      </a>
    </div>
  );
  if (!embedUrl) return (
    <div className="flex items-center justify-center h-full bg-black">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );
  return (
    <iframe src={embedUrl} className="w-full h-full border-0"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen title={clip.title} />
  );
}

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
      {/* Hero */}
      <div className="relative mb-12 rounded-2xl overflow-hidden p-8 md:p-12 border border-border/50 bg-gradient-to-br from-purple-900/20 via-background to-background">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <Trophy className="w-4 h-4" />
            <span>مسابقة أفضل المقاطع الأسبوعية مستمرة!</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight mb-4 text-glow">
            اكتشف اللحظات <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              الألعاب الملحمية
            </span>
          </h1>
          <p className="text-lg text-muted-foreground">
            أفضل المقاطع من المجتمع، يتم تصنيفها من قبلك. أرسل مقاطعك، صوّت على الآخرين، وتسلق لوحة الترتيب.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-8">
        <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <TabsList className="bg-card border border-border/50 p-1 h-12">
            <TabsTrigger value="new" className="h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Clock className="w-4 h-4 ml-2" /> الأحدث
            </TabsTrigger>
            <TabsTrigger value="top" className="h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Flame className="w-4 h-4 ml-2" /> الأعلى تقييماً
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card h-80 rounded-xl animate-pulse border border-border/50" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 text-destructive">فشل في تحميل المقاطع.</div>
      ) : clips?.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">لا توجد مقاطع بعد. كن الأول!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {clips?.map((clip: any) => (
            <ClipCard key={clip.id} clip={clip} onPlay={() => openClip(clip)} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {/* ── المشغّل الشبح ── */}
      <AnimatePresence>
        {selectedClip && <GhostPlayer clip={selectedClip} onClose={closeClip} />}
      </AnimatePresence>
    </Layout>
  );
}
