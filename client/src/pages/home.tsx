import { useState, useCallback, useEffect } from "react";
import { Layout } from "@/components/layout";
import { ClipCard } from "@/components/clip-card";
import { useClips } from "@/hooks/use-clips";
import { useUser } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Clock, Trophy, Loader2, X, ExternalLink } from "lucide-react";
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

/**
 * ✅ الدالة الرئيسية لبناء embed URL لأي كليب YouTube
 * تتعامل مع 4 حالات:
 * 1. convertedUrl هو بالفعل embed URL كامل (لكليبات youtube.com/clip/)
 * 2. videoId موجود → بناء embed عادي
 * 3. URL قديم → استخراج videoId منه
 * 4. رابط كليب → إرسال للـ FallbackPlayer
 */
function resolveYouTubeEmbedUrl(clip: any): string | null {
  const url = clip.url || "";

  // الحالة 1: convertedUrl هو embed URL كامل (لكليبات youtube.com/clip/)
  if (/youtube(-nocookie)?\.com\/embed\//i.test(url)) {
    try {
      const u = new URL(url);
      u.searchParams.set("autoplay", "1");
      u.searchParams.set("rel", "0");
      return u.toString().replace("www.youtube.com/embed", "www.youtube-nocookie.com/embed");
    } catch {
      return url;
    }
  }

  // الحالة 2: رابط كليب يوتيوب (youtube.com/clip/XXX) → لا embed مباشر
  if (/youtube\.com\/clip\//i.test(url)) {
    // إذا عندنا videoId، نبني embed مع clip param
    if (clip.videoId) {
      const clipId = url.match(/\/clip\/([A-Za-z0-9_-]+)/)?.[1];
      if (clipId) {
        return `https://www.youtube-nocookie.com/embed/${clip.videoId}?clip=${clipId}&autoplay=1&rel=0`;
      }
    }
    // نحتاج FallbackPlayer
    return null;
  }

  // الحالة 3: videoId محفوظ في DB
  const videoId   = clip.videoId   || extractFromUrl(url).videoId;
  const startTime = clip.startTime ?? extractFromUrl(url).startTime;
  const endTime   = clip.endTime   ?? extractFromUrl(url).endTime;

  if (videoId) return buildEmbedUrl(videoId, startTime, endTime);

  return null;
}

// استخراج من URL احتياطي (للكليبات القديمة بدون videoId مخزّن)
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

// ─── Kick لا يسمح بالـ embed إلا بعد تسجيل الـ domain ───────
// الحل: عرض thumbnail + زر مشاهدة مباشر على Kick بتصميم احترافي
function KickGhostPlayer({ clip, onClose }: { clip: any; onClose: () => void }) {
  const clipId    = extractKickClipId(clip);
  const directUrl = clip.url?.startsWith("http")
    ? clip.url
    : (clipId ? `https://kick.com/clips/${clipId}` : "https://kick.com");

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
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
        >
          <X className="w-5 h-5" /> إغلاق
        </button>

        <div className="relative rounded-2xl overflow-hidden border border-[#53FC1F]/20 shadow-[0_0_60px_rgba(83,252,31,0.2)] bg-black">
          {/* منطقة الفيديو — thumbnail احترافي مع زر تشغيل */}
          <div className="aspect-video w-full relative bg-[#0a0a0a] flex items-center justify-center">
            {/* Thumbnail خلفية ضبابية */}
            {clip.thumbnailUrl && (
              <>
                <img
                  src={clip.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm scale-105"
                />
                {/* Thumbnail واضح في المنتصف */}
                <img
                  src={clip.thumbnailUrl}
                  alt={clip.title}
                  className="relative z-10 h-full w-auto max-w-full object-contain shadow-2xl"
                />
              </>
            )}

            {/* طبقة تدرج + زر التشغيل */}
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50">
              {/* شعار Kick */}
              <div className="mb-6">
                <div className="w-20 h-20 rounded-2xl bg-[#53FC1F]/10 border-2 border-[#53FC1F]/40 flex items-center justify-center shadow-[0_0_30px_rgba(83,252,31,0.3)]">
                  <svg viewBox="0 0 32 32" className="w-11 h-11" fill="#53FC1F">
                    <path d="M4 4h6v10l8-10h8L16 16l10 12h-8L10 18v10H4V4z"/>
                  </svg>
                </div>
              </div>

              {/* رسالة شرح */}
              <p className="text-white/70 text-sm mb-2 text-center px-4">
                كليبات Kick تُشاهد مباشرةً على المنصة
              </p>
              <p className="text-white/40 text-xs mb-6 text-center px-4">
                اضغط الزر لفتح الكليب في Kick
              </p>

              {/* زر المشاهدة الرئيسي */}
              <a
                href={directUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="group flex items-center gap-3 bg-[#53FC1F] hover:bg-[#45e018] active:scale-95 text-black font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-[0_0_30px_rgba(83,252,31,0.5)] hover:shadow-[0_0_50px_rgba(83,252,31,0.7)]"
              >
                {/* أيقونة تشغيل */}
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-black" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                شاهد الكليب على Kick
                <ExternalLink className="w-4 h-4 opacity-60 group-hover:opacity-100" />
              </a>
            </div>
          </div>

          {/* معلومات الكليب */}
          <div className="bg-gradient-to-t from-black to-black/80 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white leading-tight mb-1 line-clamp-2">
                  {clip.title}
                </h2>
                <div className="flex items-center gap-3 text-sm text-white/60 flex-wrap">
                  <span>بواسطة <span className="text-white/80 font-medium">{clip.submitterName || clip.submitter?.username || "زائر"}</span></span>
                  {clip.tag && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      <span className="text-[#53FC1F] font-medium">{TAG_LABELS[clip.tag] ?? clip.tag}</span>
                    </>
                  )}
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span className="bg-[#53FC1F]/10 text-[#53FC1F] text-xs font-bold px-2 py-0.5 rounded-md border border-[#53FC1F]/30 uppercase tracking-wider">
                    Kick
                  </span>
                </div>
              </div>
              <a
                href={directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/40 hover:text-[#53FC1F]/80 transition-colors mt-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> فتح ↗
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
//  مشغّل كليبات YouTube (youtube.com/clip/) — لا تدعم embed
// ─────────────────────────────────────────────────────────────
function YouTubeClipPlayer({ clip, onClose }: { clip: any; onClose: () => void }) {
  const directUrl = clip.url?.startsWith("http") ? clip.url : "https://youtube.com";
  const TAG_LABELS: Record<string, string> = {
    Funny: "😂 مضحك", Epic: "⚡ ملحمي",
    Glitch: "🐛 باج", Skill: "🎯 مهارة", Horror: "👻 مرعب",
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.85, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 30 }} transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="relative w-full max-w-4xl mx-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-12 right-0 text-white/60 hover:text-white flex items-center gap-2 transition-colors">
          <X className="w-5 h-5" /> إغلاق
        </button>
        <div className="relative rounded-2xl overflow-hidden border border-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.15)] bg-black">
          <div className="aspect-video w-full relative bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
            {clip.thumbnailUrl && (
              <>
                <img src={clip.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-md scale-110" />
                <img src={clip.thumbnailUrl} alt={clip.title} className="relative z-10 h-full w-auto max-w-full object-contain shadow-2xl" />
              </>
            )}
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 gap-6">
              <div className="w-20 h-20 rounded-2xl bg-red-600/10 border-2 border-red-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                <svg viewBox="0 0 90 63" className="w-11 h-11 fill-red-600">
                  <path d="M88.1 9.9C87 5.7 83.8 2.5 79.7 1.4 72.7 0 45 0 45 0S17.3 0 10.3 1.4C6.2 2.5 3 5.7 1.9 9.9 0 16.4 0 31.5 0 31.5s0 15.1 1.9 21.6c1.1 4.2 4.3 7.4 8.4 8.5C17.3 63 45 63 45 63s27.7 0 34.7-1.4c4.1-1.1 7.3-4.3 8.4-8.5C90 46.6 90 31.5 90 31.5s0-15.1-1.9-21.6z"/>
                  <path d="M36 45l23.3-13.5L36 18z" fill="white"/>
                </svg>
              </div>
              <div className="text-center px-4">
                <p className="text-white/70 text-sm mb-1">كليبات YouTube تُشاهد مباشرةً على المنصة</p>
                <p className="text-white/40 text-xs">اضغط الزر لفتح الكليب في YouTube</p>
              </div>
              <a href={directUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                className="group flex items-center gap-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:shadow-[0_0_50px_rgba(239,68,68,0.7)]">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M8 5v14l11-7z"/></svg>
                شاهد الكليب على YouTube
                <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100" />
              </a>
            </div>
          </div>
          <div className="bg-gradient-to-t from-black to-black/80 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white leading-tight mb-1 line-clamp-2">{clip.title}</h2>
                <div className="flex items-center gap-3 text-sm text-white/60 flex-wrap">
                  <span>بواسطة <span className="text-white/80 font-medium">{clip.submitterName || clip.submitter?.username || "زائر"}</span></span>
                  {clip.tag && (<><span className="w-1 h-1 rounded-full bg-white/30" /><span className="text-red-400 font-medium">{TAG_LABELS[clip.tag] ?? clip.tag}</span></>)}
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span className="bg-red-600/10 text-red-400 text-xs font-bold px-2 py-0.5 rounded-md border border-red-500/30 uppercase tracking-wider">YouTube Clip</span>
                </div>
              </div>
              <a href={directUrl} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/40 hover:text-red-400 transition-colors mt-1">
                <ExternalLink className="w-3.5 h-3.5" /> فتح ↗
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
//  المشغّل الرئيسي — YouTube + Kick + YouTube Clips
// ─────────────────────────────────────────────────────────────
function GhostPlayer({ clip, onClose }: { clip: any; onClose: () => void }) {
  const isKick   = clip.platform === "kick" || /kick\.com/i.test(clip.url || "");
  const isYTClip = /youtube\.com\/clip\//i.test(clip.url || "");

  if (isKick)   return <KickGhostPlayer   clip={clip} onClose={onClose} />;
  if (isYTClip) return <YouTubeClipPlayer clip={clip} onClose={onClose} />;

  // ── YouTube فيديو عادي ──────────────────────────────────
  const embedUrl  = resolveYouTubeEmbedUrl(clip);
  const videoId   = clip.videoId || extractFromUrl(clip.url).videoId;
  const startTime = clip.startTime ?? 0;
  const endTime   = clip.endTime   ?? 0;
  const TAG_LABELS: Record<string, string> = {
    Funny: "😂 مضحك", Epic: "⚡ ملحمي",
    Glitch: "🐛 باج", Skill: "🎯 مهارة", Horror: "👻 مرعب",
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.85, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 30 }} transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="relative w-full max-w-4xl mx-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-12 right-0 text-white/60 hover:text-white flex items-center gap-2 transition-colors">
          <X className="w-5 h-5" /> إغلاق
        </button>
        <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(168,85,247,0.2)] bg-black">
          <div className="aspect-video w-full">
            {embedUrl ? (
              <iframe key={clip.id} src={embedUrl} className="w-full h-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen title={clip.title} />
            ) : (
              <FallbackPlayer clip={clip} />
            )}
          </div>
          <div className="bg-gradient-to-t from-black/90 to-black/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white leading-tight mb-1 line-clamp-1">{clip.title}</h2>
                <div className="flex items-center gap-3 text-sm text-white/60">
                  <span>بواسطة <span className="text-white/80 font-medium">{clip.submitterName || clip.submitter?.username || "زائر"}</span></span>
                  {clip.tag && (<><span className="w-1 h-1 rounded-full bg-white/30" /><span className="text-primary font-medium">{TAG_LABELS[clip.tag] ?? clip.tag}</span></>)}
                  {startTime > 0 && (<><span className="w-1 h-1 rounded-full bg-white/30" /><span className="font-mono text-xs bg-white/10 px-2 py-0.5 rounded">{Math.floor(startTime/60)}:{String(startTime%60).padStart(2,"0")}{endTime > 0 && ` → ${Math.floor(endTime/60)}:${String(endTime%60).padStart(2,"0")}`}</span></>)}
                </div>
              </div>
              {videoId && (
                <a href={`https://www.youtube.com/watch?v=${videoId}&t=${startTime}`} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
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
// Fallback: يستدعي السيرفر لتحويل الرابط — يدعم YouTube Clips الجديدة
function FallbackPlayer({ clip }: { clip: any }) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [failed,   setFailed]   = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    setEmbedUrl(null);

    fetch(`/api/resolve-url?url=${encodeURIComponent(clip.url)}`)
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.embedUrl) {
          // ✅ السيرفر أرجع embed URL جاهز (لكليبات youtube.com/clip/)
          setEmbedUrl(d.embedUrl);
        } else if (d.videoId) {
          // فيديو عادي مع videoId
          setEmbedUrl(buildEmbedUrl(d.videoId, d.startTime || 0, d.endTime || 0));
        } else {
          setFailed(true);
        }
      })
      .catch(() => { setLoading(false); setFailed(true); });
  }, [clip.url]);

  const isYouTubeClip = /youtube\.com\/clip\//i.test(clip.url || "");

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-black">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-red-500" />
        <p className="text-white/50 text-sm">جاري تحميل الكليب...</p>
      </div>
    </div>
  );

  if (failed) return (
    <div className="flex flex-col items-center justify-center h-full gap-5 bg-black text-white p-6">
      {/* YouTube thumbnail */}
      {clip.thumbnailUrl && (
        <img src={clip.thumbnailUrl} alt={clip.title}
          className="w-full max-w-xs rounded-xl opacity-60 shadow-2xl" />
      )}
      {/* شعار YouTube */}
      <div className="flex flex-col items-center gap-3 text-center">
        <svg viewBox="0 0 90 20" className="h-8 fill-red-600">
          <path d="M27.9727 3.12324C27.6435 1.89323 26.6768 0.926623 25.4468 0.597366C23.2197 0 14.285 0 14.285 0C14.285 0 5.35042 0 3.12323 0.597366C1.89323 0.926623 0.926623 1.89323 0.597366 3.12324C0 5.35042 0 10 0 10C0 10 0 14.6496 0.597366 16.8768C0.926623 18.1068 1.89323 19.0734 3.12323 19.4026C5.35042 20 14.285 20 14.285 20C14.285 20 23.2197 20 25.4468 19.4026C26.6768 19.0734 27.6435 18.1068 27.9727 16.8768C28.5701 14.6496 28.5701 10 28.5701 10C28.5701 10 28.5677 5.35042 27.9727 3.12324Z"/>
          <path d="M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z" fill="white"/>
        </svg>
        <p className="text-white/60 text-sm max-w-xs">
          {isYouTubeClip
            ? "كليبات YouTube الجديدة تحتاج فتحها مباشرةً على YouTube"
            : "لا يمكن تشغيل هذا الفيديو مباشرةً"}
        </p>
        <a href={clip.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)]">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M8 5v14l11-7z"/></svg>
          {isYouTubeClip ? "شاهد الكليب على YouTube" : "افتح على YouTube"}
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );

  if (!embedUrl) return null;

  return (
    <iframe src={embedUrl} className="w-full h-full border-0"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen title={clip.title} />
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
