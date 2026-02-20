import { useState, useCallback, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { ClipCard } from "@/components/clip-card";
import { useClips } from "@/hooks/use-clips";
import { useUser } from "@/hooks/use-auth";
import {
  Clock, X, ExternalLink, Zap, Share2, Check,
  Loader2, ShieldCheck, Palette, Globe, ChevronRight,
  Sparkles, Star, TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────
//  يوتيوب / كليب بلاير — كود محفوظ بالكامل بدون تغيير
// ─────────────────────────────────────────────────────────────
function buildEmbedUrl(videoId: string, startTime = 0, endTime = 0): string {
  const p = new URLSearchParams({
    autoplay: "1", rel: "0", modestbranding: "1",
    start: String(startTime), enablejsapi: "0",
    iv_load_policy: "3", color: "white",
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
  const videoId = clip.videoId || extractFromUrl(url).videoId;
  const startTime = clip.startTime ?? extractFromUrl(url).startTime;
  const endTime = clip.endTime ?? extractFromUrl(url).endTime;
  if (videoId) return buildEmbedUrl(videoId, startTime, endTime);
  return null;
}

function extractFromUrl(url: string): { videoId: string | null; startTime: number; endTime: number } {
  if (!url) return { videoId: null, startTime: 0, endTime: 0 };
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v) return { videoId: v, startTime: parseInt(u.searchParams.get("start") ?? "0") || 0, endTime: parseInt(u.searchParams.get("end") ?? "0") || 0 };
    const short = url.match(/youtu\.be\/([\w-]{11})/);
    if (short) return { videoId: short[1], startTime: 0, endTime: 0 };
    const local = url.match(/\/([a-zA-Z0-9_-]{11})_(\d+)-(\d+)\.mp4$/);
    if (local) return { videoId: local[1], startTime: +local[2], endTime: +local[3] };
  } catch {}
  return { videoId: null, startTime: 0, endTime: 0 };
}

function extractKickClipId(clip: any): string {
  let clipId = clip.videoId || "";
  if (!clipId && clip.url) {
    const patterns = [/kick\.com\/clip\/([A-Za-z0-9_-]+)/i, /kick\.com\/[^/]+\/clips?\/([A-Za-z0-9_-]+)/i, /kick\.com\/clips\/([A-Za-z0-9_-]+)/i];
    for (const p of patterns) { const m = clip.url.match(p); if (m?.[1]) { clipId = m[1]; break; } }
  }
  return clipId;
}

const TAG_LABELS: Record<string, string> = {
  Funny: "😂 مضحك", Epic: "⚡ ملحمي", Glitch: "🐛 باج", Skill: "🎯 مهارة", Horror: "👻 مرعب",
};

function PlayerModal({ clip, onClose, accentColor, children }: { clip: any; onClose: () => void; accentColor: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/clips/${clip.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: clip.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}>
      <div className="absolute inset-0 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.88, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 24 }} transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="relative w-full max-w-5xl z-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor }} />
            <span className="text-white/50 text-sm">يتم التشغيل الآن</span>
          </div>
          <button onClick={onClose} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" /><span>إغلاق</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 font-mono">ESC</kbd>
          </button>
        </div>
        <div className="relative rounded-2xl overflow-hidden bg-[#0a0a0a]" style={{ boxShadow: `0 0 80px -20px ${accentColor}, 0 0 0 1px rgba(255,255,255,0.07)` }}>
          {children}
          <div className="px-5 py-4 bg-gradient-to-r from-black/80 to-black/60 border-t border-white/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white leading-tight mb-1 truncate">{clip.title}</h2>
                <div className="flex items-center gap-2 text-xs text-white/50 flex-wrap">
                  <span>بواسطة</span>
                  <span className="text-white/80 font-medium">{clip.submitterName || clip.submitter?.username || "زائر"}</span>
                  {clip.tag && (<><span className="w-1 h-1 rounded-full bg-white/20" /><span style={{ color: accentColor }}>{TAG_LABELS[clip.tag] ?? clip.tag}</span></>)}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* زر نسخ رابط المشاركة — Discord / Twitter / Telegram */}
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-xs transition-all px-2.5 py-1.5 rounded-lg border"
                  style={{
                    background: copied ? "rgba(34,197,94,0.15)" : "rgba(168,85,247,0.1)",
                    borderColor: copied ? "rgba(34,197,94,0.4)" : "rgba(168,85,247,0.3)",
                    color: copied ? "#4ade80" : "#a855f7",
                  }}
                  title="نسخ رابط المشاركة (Discord / Twitter)"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  {copied ? "تم النسخ!" : "مشاركة"}
                </button>
                <a href={clip.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />فتح خارجياً
                </a>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
//  🎬 SmartPlayer — مشغّل موحّد يعرض الفيديو مباشرةً
//  YouTube: embed iframe داخل المنصة
//  Kick: redirect (لا يدعمون embed خارج منصتهم)
// ─────────────────────────────────────────────────────────────

/** هل الرابط mp4 مباشر (Kick CDN أو ما شابه)؟ */
function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|m3u8)(\?|$)/i.test(url)
    || /clips\.(kick|twitch)\.tv/i.test(url)
    || /edge\.(kick|twitch)\.tv/i.test(url)
    || /d2nvs31859zcd8\.cloudfront\.net/i.test(url)
    || /media\.kick\.com/i.test(url);
}

/** يبني embed URL من بيانات الكليب المخزّنة (بدون API call) */
function getStoredEmbedUrl(clip: any): string | null {
  const url = clip.url || "";
  const isKick = /kick\.com/i.test(url) || clip.platform === "kick";

  // ─── Kick ─────────────────────────────────────────────────
  if (isKick) {
    // ✅ الأولوية: mp4 مباشر مخزّن في videoId (من API)
    if (clip.videoId && isDirectVideoUrl(clip.videoId)) return clip.videoId;
    // url مباشر مخزّن في url field
    if (isDirectVideoUrl(url)) return url;
    // إذا خُزِّن رابط player.kick.com مباشرة
    if (/player\.kick\.com/i.test(url)) return url;
    // استخراج UUID أو slug من URL
    const kickId = clip.videoId || url.match(/kick\.com\/[^/]+\/clips?\/([A-Za-z0-9_-]+)/i)?.[1]
      || url.match(/kick\.com\/clips?\/([A-Za-z0-9_-]+)/i)?.[1]
      || url.match(/kick\.com\/clip\/([A-Za-z0-9_-]+)/i)?.[1];
    if (kickId) return `https://player.kick.com/video/${kickId}`;
    return null;
  }

  // ─── YouTube embed ────────────────────────────────────────
  // url مخزّن كـ embed URL مباشرة
  if (/youtube(-nocookie)?\.com\/embed\//i.test(url)) {
    try {
      const u = new URL(url);
      u.searchParams.set("autoplay", "1");
      u.searchParams.set("rel", "0");
      // ✅ لا نستبدل بـ nocookie إذا كان clip/clipt موجود — يكسر الـ clip!
      if (u.searchParams.has("clip") || u.searchParams.has("clipt")) {
        return u.toString().replace("www.youtube-nocookie.com/embed", "www.youtube.com/embed");
      }
      return u.toString().replace("www.youtube.com/embed", "www.youtube-nocookie.com/embed");
    } catch { return url; }
  }
  // youtube.com/clip/ مع videoId مخزّن
  if (/youtube\.com\/clip\//i.test(url) && clip.videoId) {
    const clipId = url.match(/\/clip\/([A-Za-z0-9_-]+)/)?.[1];
    // ✅ استخدام youtube.com (ليس nocookie) للـ clip embeds
    if (clipId) return `https://www.youtube.com/embed/${clip.videoId}?clip=${clipId}&autoplay=1&rel=0&modestbranding=1`;
  }
  // videoId مخزّن مباشرة
  if (clip.videoId && !isDirectVideoUrl(clip.videoId)) {
    return buildEmbedUrl(clip.videoId, clip.startTime || 0, clip.endTime || 0);
  }
  // استخراج من رابط watch?v=
  const { videoId, startTime, endTime } = extractFromUrl(url);
  if (videoId) return buildEmbedUrl(videoId, startTime, endTime);
  return null;
}

/** شاشة تحميل نصف شفافة فوق الـ thumbnail */
function PlayerLoading({ clip }: { clip: any }) {
  return (
    <div className="relative aspect-video w-full bg-black overflow-hidden">
      {clip.thumbnailUrl && (
        <img src={clip.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm scale-105" />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
        <Loader2 className="w-10 h-10 animate-spin text-white/70" />
        <p className="text-white/50 text-sm">جاري تحميل الكليب...</p>
      </div>
    </div>
  );
}

/** شاشة الـ fallback عند فشل التضمين — مع زر فتح خارجي */
function PlayerFailed({ clip, platform }: { clip: any; platform: "youtube" | "kick" | string }) {
  const isKick = platform === "kick";
  const directUrl = clip.url?.startsWith("http") ? clip.url : (isKick ? "https://kick.com" : "https://youtube.com");
  const accentColor = isKick ? "#53FC1F" : "#ff0000";
  const accentShadow = isKick ? "rgba(83,252,31,0.6)" : "rgba(255,0,0,0.5)";

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-[#050505] group cursor-pointer">
      {/* ── Thumbnail كاملة كخلفية ── */}
      {clip.thumbnailUrl ? (
        <img
          src={clip.thumbnailUrl}
          alt={clip.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black" />
      )}

      {/* gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

      {/* ── زر تشغيل ضخم في المنتصف ── */}
      <a
        href={directUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 flex flex-col items-center justify-center gap-4"
      >
        {/* دائرة الزر */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
          style={{
            background: accentColor,
            boxShadow: `0 0 0 8px ${accentColor}30, 0 0 50px ${accentShadow}`,
          }}
        >
          {/* أيقونة المنصة بدل السهم */}
          {isKick ? (
            <svg viewBox="0 0 32 32" className="w-10 h-10" fill="#000">
              <path d="M4 4h6v10l8-10h8L16 16l10 12h-8L10 18v10H4V4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-10 h-10 ml-1" fill="white">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </div>

        {/* نص */}
        <div className="text-center">
          <p className="text-white font-bold text-base drop-shadow-lg">
            شاهد على {isKick ? "Kick" : "YouTube"}
          </p>
          <p className="text-white/60 text-xs mt-0.5">يفتح في تبويب جديد</p>
        </div>
      </a>

      {/* ── شارة المنصة في الزاوية ── */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
        style={{ background: `${accentColor}20`, border: `1.5px solid ${accentColor}60`, color: accentColor }}>
        {isKick ? (
          <svg viewBox="0 0 32 32" className="w-3.5 h-3.5" fill={accentColor}>
            <path d="M4 4h6v10l8-10h8L16 16l10 12h-8L10 18v10H4V4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 90 63" className="w-4 h-3" fill={accentColor}>
            <path d="M88.1 9.9C87 5.7 83.8 2.5 79.7 1.4 72.7 0 45 0 45 0S17.3 0 10.3 1.4C6.2 2.5 3 5.7 1.9 9.9 0 16.4 0 31.5 0 31.5s0 15.1 1.9 21.6c1.1 4.2 4.3 7.4 8.4 8.5C17.3 63 45 63 45 63s27.7 0 34.7-1.4c4.1-1.1 7.3-4.3 8.4-8.5C90 46.6 90 31.5 90 31.5s0-15.1-1.9-21.6z"/>
            <path d="M36 45l23.3-13.5L36 18z" fill="white"/>
          </svg>
        )}
        {isKick ? "Kick" : "YouTube"}
      </div>

      {/* ── تنبيه صغير في الأسفل ── */}
      <div className="absolute bottom-3 inset-x-3 flex items-center justify-center">
        <span className="text-white/40 text-[10px] flex items-center gap-1">
          <ExternalLink className="w-2.5 h-2.5" />
          {isKick
            ? "Kick لا يسمح بالتضمين — سيُفتح على المنصة"
            : "هذا المقطع محمي — سيُفتح على YouTube"}
        </span>
      </div>
    </div>
  );
}

/** iframe مع اكتشاف الحجب التلقائي */
function IframePlayer({ src, title, onFail }: { src: string; title: string; onFail: () => void }) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // إذا لم يُحمَّل خلال 7 ثواني → اعتبره محجوباً
    const timer = setTimeout(() => {
      try {
        // محاولة قراءة contentDocument — إذا فشلت فهو يعمل (CORS = محتوى خارجي عادي)
        // إذا نجحت وكان الـ body فارغاً → محجوب
        const doc = ref.current?.contentDocument;
        if (doc && (!doc.body || doc.body.innerHTML.trim() === "")) {
          onFail();
        }
      } catch {
        // CORS error = iframe loaded external content normally
      }
    }, 7000);
    return () => clearTimeout(timer);
  }, [src, onFail]);

  return (
    <div className="relative w-full aspect-video bg-black">
      <iframe
        ref={ref}
        src={src}
        className="w-full h-full border-0 block absolute inset-0"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
        allowFullScreen
        title={title}
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

/** المشغّل الموحّد — يجلب رابط تشغيل حديث دائماً من السيرفر */
function SmartVideoPlayer({ clip, onClose }: { clip: any; onClose: () => void }) {
  const isKick = clip.platform === "kick" || /kick\.com/i.test(clip.url || "");
  const accentColor = isKick ? "#53FC1F" : "rgba(168,85,247,0.9)";

  const [playerType, setPlayerType] = useState<"iframe" | "direct" | "external" | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    // ✅ دائماً اجلب رابط تشغيل حديث من السيرفر (يحلّ مشكلة clipt المنتهي الصلاحية)
    fetch(`/api/clips/${clip.id}/fresh-player`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        if (d.type === "direct" && d.url) {
          setPlayerType("direct");
          setEmbedUrl(d.url);
        } else if (d.type === "iframe" && d.url) {
          setPlayerType("iframe");
          setEmbedUrl(d.url);
        } else if (d.type === "external") {
          setPlayerType("external");
          setEmbedUrl(d.url || clip.url);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        // fallback محلي
        const stored = getStoredEmbedUrl(clip);
        if (stored) {
          setPlayerType(isDirectVideoUrl(stored) ? "direct" : "iframe");
          setEmbedUrl(stored);
        } else {
          setFailed(true);
        }
      })
      .finally(() => setLoading(false));
  }, [clip.id]);

  const canPlay = !!embedUrl && !failed && playerType !== "external";
  const isExternal = playerType === "external" || (failed && !embedUrl);

  return (
      <PlayerModal clip={clip} onClose={onClose} accentColor={accentColor}>
      {/* ── جاري التحميل ─────────────────────────────── */}
      {loading && <PlayerLoading clip={clip} />}

      {/* ── HTML5 video مباشر (Kick mp4 CDN) ────────── */}
      {!loading && canPlay && playerType === "direct" && (
        <div className="relative w-full aspect-video bg-black">
          <video
            key={embedUrl!}
            src={embedUrl!}
            className="w-full h-full block"
            controls
            autoPlay
            playsInline
          >
            <source src={embedUrl!} type="video/mp4" />
          </video>
        </div>
      )}

      {/* ── iframe (YouTube embed كامل) ──────────────── */}
      {!loading && canPlay && playerType === "iframe" && !failed && (
        <IframePlayer
          key={embedUrl!}
          src={embedUrl!}
          title={clip.title}
          onFail={() => setFailed(true)}
        />
      )}

      {/* ── fallback: مشاهدة خارجية (Kick أو يوتيوب محمي) ── */}
      {!loading && (isExternal || failed) && (
        <PlayerFailed clip={clip} platform={isKick ? "kick" : "youtube"} />
      )}
    </PlayerModal>
  );
}

/** اسم قديم للتوافق مع الاستخدامات الموجودة */
function GhostPlayer({ clip, onClose }: { clip: any; onClose: () => void }) {
  return <SmartVideoPlayer clip={clip} onClose={onClose} />;
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
//  تعريف الأقسام
// ─────────────────────────────────────────────────────────────
type SectionId = "verified" | "community";

const SECTIONS = [
  {
    id: "verified" as SectionId,
    icon: ShieldCheck,
    emoji: "🏆",
    title: "الكليبات الموثّقة",
    subtitle: "أفضل اللحظات المختارة بعناية",
    description: "مقاطع راجعها الفريق وأقرّها — فقط الأفضل يصل هنا",
    accent: "#a855f7",
    accentBg: "rgba(168,85,247,0.12)",
    accentBorder: "rgba(168,85,247,0.3)",
    glow: "rgba(168,85,247,0.4)",
    gradient: "linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(168,85,247,0.04) 100%)",
    badge: "موثّق",
    badgeColor: "#a855f7",
  },
  {
    id: "community" as SectionId,
    icon: Globe,
    emoji: "🌐",
    title: "مجتمع المقترحات",
    subtitle: "كل ما شاركه الأعضاء",
    description: "كليبات وصور ورسومات مجتمعية في انتظار مراجعة الفريق",
    accent: "#f59e0b",
    accentBg: "rgba(245,158,11,0.12)",
    accentBorder: "rgba(245,158,11,0.3)",
    glow: "rgba(245,158,11,0.4)",
    gradient: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.04) 100%)",
    badge: "مجتمع",
    badgeColor: "#f59e0b",
  },
] as const;

// ─────────────────────────────────────────────────────────────
//  بطاقة القسم في الصفحة الرئيسية
// ─────────────────────────────────────────────────────────────
function SectionCard({ section, index, onClick }: { section: typeof SECTIONS[number]; index: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const Icon = section.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 + 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onClick}
      className="group relative cursor-pointer rounded-3xl overflow-hidden border transition-all duration-500"
      style={{
        background: hovered ? section.gradient : "rgba(255,255,255,0.02)",
        borderColor: hovered ? section.accentBorder : "rgba(255,255,255,0.06)",
        boxShadow: hovered ? `0 32px 64px -16px ${section.glow}, 0 0 0 1px ${section.accentBorder}` : "none",
        transform: hovered ? "translateY(-6px) scale(1.01)" : "translateY(0) scale(1)",
      }}
    >
      {/* خلفية ضوء داخلي */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at 20% 20%, ${section.accentBg}, transparent 70%)`,
          opacity: hovered ? 1 : 0,
        }}
      />

      {/* نمط نقطي خلفي */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(${section.accent}22 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 p-7">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform duration-300"
            style={{
              background: section.accentBg,
              border: `1.5px solid ${section.accentBorder}`,
              boxShadow: hovered ? `0 0 24px ${section.glow}` : "none",
              transform: hovered ? "scale(1.1) rotate(-4deg)" : "scale(1)",
            }}
          >
            {section.emoji}
          </div>
          <motion.div
            animate={{ x: hovered ? 4 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight
              className="w-5 h-5 transition-colors duration-300"
              style={{ color: hovered ? section.accent : "rgba(255,255,255,0.2)" }}
            />
          </motion.div>
        </div>

        {/* Badge */}
        <div className="mb-3">
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
            style={{
              background: section.accentBg,
              color: section.accent,
              border: `1px solid ${section.accentBorder}`,
            }}
          >
            {section.badge}
          </span>
        </div>

        {/* Text */}
        <h3 className="text-xl font-bold text-white/90 mb-1.5 leading-tight">{section.title}</h3>
        <p
          className="text-sm font-medium mb-2 transition-colors duration-300"
          style={{ color: hovered ? section.accent : "rgba(255,255,255,0.5)" }}
        >
          {section.subtitle}
        </p>
        <p className="text-xs text-white/35 leading-relaxed">{section.description}</p>

        {/* Footer line */}
        <div
          className="mt-6 pt-4 border-t flex items-center gap-2 transition-all duration-300"
          style={{ borderColor: hovered ? section.accentBorder : "rgba(255,255,255,0.05)" }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: section.accent }} />
          <span className="text-xs text-white/40">اضغط للدخول</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
//  رأس القسم الداخلي
// ─────────────────────────────────────────────────────────────
function SectionHeader({ section, onBack, sortBy, setSortBy, count }: {
  section: typeof SECTIONS[number];
  onBack: () => void;
  sortBy: "new" | "top";
  setSortBy: (v: "new" | "top") => void;
  count?: number;
}) {
  const Icon = section.icon;
  return (
    <div className="mb-8">
      {/* Breadcrumb */}
      <motion.button
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-5 group"
      >
        <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
        الرئيسية
      </motion.button>

      {/* Section hero strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative rounded-2xl overflow-hidden p-6 border mb-6"
        style={{
          background: section.gradient,
          borderColor: section.accentBorder,
          boxShadow: `0 0 60px -20px ${section.glow}`,
        }}
      >
        {/* Glow blob */}
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${section.accentBg}, transparent)`, transform: "translate(30%, -40%)" }}
        />

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
              style={{ background: section.accentBg, border: `1.5px solid ${section.accentBorder}` }}
            >
              {section.emoji}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{section.title}</h1>
              <p className="text-sm" style={{ color: section.accent }}>{section.subtitle}</p>
            </div>
          </div>

          {count !== undefined && (
            <div
              className="text-xs font-mono px-3 py-1.5 rounded-full"
              style={{ background: section.accentBg, color: section.accent, border: `1px solid ${section.accentBorder}` }}
            >
              {count} عنصر
            </div>
          )}
        </div>
      </motion.div>

      {/* Sort controls */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex gap-1.5 p-1 rounded-xl border border-white/8 bg-black/30 w-fit"
      >
        {[
          { value: "new", icon: Clock, label: "الأحدث" },
          { value: "top", icon: TrendingUp, label: "الأعلى تقييماً" },
        ].map(({ value, icon: Ico, label }) => (
          <button
            key={value}
            onClick={() => setSortBy(value as any)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: sortBy === value ? section.accent : "transparent",
              color: sortBy === value ? "white" : "rgba(255,255,255,0.45)",
            }}
          >
            <Ico className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  محتوى قسم الكليبات (موثقة أو مجتمع)
// ─────────────────────────────────────────────────────────────
function ClipsSection({ section, status, isAdmin, sortBy, initialClip }: {
  section: typeof SECTIONS[number];
  status: "approved" | "pending";
  isAdmin: boolean;
  sortBy: "new" | "top";
  initialClip?: any;
}) {
  const [selectedClip, setSelected] = useState<any>(initialClip || null);
  const openClip = useCallback((clip: any) => setSelected(clip), []);
  const closeClip = useCallback(() => setSelected(null), []);

  // فتح الكليب المُمرَّر تلقائياً عند التحميل الأول
  useEffect(() => {
    if (initialClip) setSelected(initialClip);
  }, [initialClip]);

  const { data: clips, isLoading, error } = useClips({ status, sort: sortBy });

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </motion.div>
        ) : error ? (
          <motion.div key="error" className="text-center py-20 text-destructive">فشل في تحميل المقاطع.</motion.div>
        ) : clips?.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-24 space-y-3">
            <div className="text-5xl mb-4">{section.emoji}</div>
            <p className="text-lg font-semibold text-foreground/80">لا يوجد محتوى بعد</p>
            <p className="text-sm text-muted-foreground">كن الأول وأرسل مقطعك!</p>
          </motion.div>
        ) : (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {clips?.map((clip: any, i: number) => (
              <motion.div key={clip.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}>
                <ClipCard clip={clip} onPlay={() => openClip(clip)} isAdmin={isAdmin} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedClip && <GhostPlayer clip={selectedClip} onClose={closeClip} />}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Community section — يجمع كليبات ورسومات الحالة 'pending'
// ─────────────────────────────────────────────────────────────
function CommunitySection({ section, isAdmin, sortBy }: { section: typeof SECTIONS[number]; isAdmin: boolean; sortBy: "new" | "top" }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/clips?status=pending&sort=${sortBy}`).then(r => r.ok ? r.json() : [] as any[]).catch(() => []),
      fetch(`/api/artworks?status=pending`).then(r => r.ok ? r.json() : [] as any[]).catch(() => []),
    ]).then(([clips, artworks]) => {
      if (!mounted) return;
      // normalize and merge, keep newest first by createdAt
      const normClips = (clips || []).map((c: any) => ({ type: "clip", id: `clip-${c.id}`, payload: c, createdAt: c.createdAt || Date.now() }));
      const normArts  = (artworks || []).map((a: any) => ({ type: "art", id: `art-${a.id}`, payload: a, createdAt: a.createdAt || Date.now() }));
      const merged = [...normClips, ...normArts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(merged);
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [sortBy]);

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {[...Array(8)].map((_, i) => <div key={i} className="h-48 bg-white/6 rounded-2xl animate-pulse" />)}
    </div>
  );

  if (items.length === 0) return (
    <div className="text-center py-24 text-muted-foreground">لا توجد مشاركات حالياً</div>
  );

  const [playingClip, setPlayingClip] = useState<any>(null);
  const [viewingArt, setViewingArt] = useState<any>(null);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {items.map((it) => (
          <div key={it.id}>
            {it.type === "clip" ? (
              <ClipCard clip={it.payload} onPlay={() => setPlayingClip(it.payload)} isAdmin={isAdmin} />
            ) : (
              <ArtworkCard art={it.payload} onClick={() => setViewingArt(it.payload)} />
            )}
          </div>
        ))}
      </div>
      {/* Player for clips */}
      <AnimatePresence>
        {playingClip && <GhostPlayer clip={playingClip} onClose={() => setPlayingClip(null)} />}
      </AnimatePresence>
      {/* Viewer for artworks */}
      <AnimatePresence>
        {viewingArt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setViewingArt(null)}>
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
              className="max-w-2xl w-full bg-[#12121e] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <img src={viewingArt.imageData} alt={viewingArt.artistName} className="w-full object-contain max-h-[65vh]" />
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold">{viewingArt.artistName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-amber-300 text-xs">قيد المراجعة</span>
                  </div>
                </div>
                <button onClick={() => setViewingArt(null)} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  أفاتار الفنان — يعرض الصورة المخصصة أو حرف ملوّن كاحتياطي
// ─────────────────────────────────────────────────────────────
function ArtistAvatar({ art, size = "sm" }: { art: any; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const hue = ((art.artistName?.charCodeAt(0) ?? 65) * 53) % 360;
  const sizeClass = size === "md"
    ? "w-10 h-10 rounded-xl text-sm"
    : "w-7 h-7 rounded-full text-xs";

  if (art.artistAvatar && !failed) {
    return (
      <img
        src={art.artistAvatar}
        alt={art.artistName}
        onError={() => setFailed(true)}
        className={`${sizeClass} flex-shrink-0 object-cover border border-white/10`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} flex-shrink-0 flex items-center justify-center text-white font-black`}
      style={{ background: `hsl(${hue},60%,40%)` }}
    >
      {art.artistName?.[0] ?? "؟"}
    </div>
  );
}

// بطاقة العمل الفني
function ArtworkCard({ art, onClick }: { art: any; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-white/6 bg-[#0d0d12]
        hover:border-cyan-500/40 hover:shadow-[0_0_24px_rgba(6,182,212,0.15)] transition-all duration-300"
    >
      <div className="aspect-[4/3] overflow-hidden bg-[#111] relative">
        <img
          src={art.imageData}
          alt={art.artistName}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* gradient on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {/* zoom icon */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white text-lg">🔍</span>
          </div>
        </div>
      </div>
      <div className="p-3 flex items-center gap-2">
        <ArtistAvatar art={art} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/80 truncate">{art.artistName}</p>
          <p className="text-[10px] text-white/30">
            {new Date(art.createdAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// نافذة عرض العمل الفني بالكامل
function ArtworkModal({ art, onClose }: { art: any; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-lg"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="relative max-w-2xl w-full"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/50 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
        >
          <X className="w-4 h-4" /> إغلاق <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 font-mono">ESC</kbd>
        </button>
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a12]"
          style={{ boxShadow: "0 0 80px rgba(6,182,212,0.2), 0 0 0 1px rgba(255,255,255,0.06)" }}>
          <img src={art.imageData} alt={art.artistName} className="w-full object-contain max-h-[65vh] bg-[#111]" />
          <div className="p-4 flex items-center gap-3 border-t border-white/6">
            <ArtistAvatar art={art} size="md" />
            <div>
              <p className="font-bold text-white">{art.artistName}</p>
              <p className="text-xs text-white/40">
                {new Date(art.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
//  قسم الرسم والصور — معرض حقيقي
// ─────────────────────────────────────────────────────────────
function ArtSection({ section }: { section: typeof SECTIONS[number] }) {
  const [artworks, setArtworks]   = useState<any[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [selected, setSelected]   = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/artworks?status=approved")
      .then(r => r.json())
      .then(d => setArtworks(Array.isArray(d) ? d : []))
      .catch(() => setArtworks([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[4/3] rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : artworks.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 gap-6 text-center">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl"
            style={{ background: section.accentBg, border: `2px solid ${section.accentBorder}`, boxShadow: `0 0 40px ${section.glow}` }}>
            🎨
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white/70">لا توجد رسومات بعد</h2>
            <p className="text-sm text-muted-foreground max-w-xs">كن أول من يشارك إبداعه مع المجتمع!</p>
          </div>
          <a href="/draw"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: section.accentBg, color: section.accent, border: `1.5px solid ${section.accentBorder}` }}>
            <Sparkles className="w-4 h-4" /> ارسم الآن
          </a>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {artworks.map((art: any, i: number) => (
            <motion.div key={art.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}>
              <ArtworkCard art={art} onClick={() => setSelected(art)} />
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selected && <ArtworkModal art={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  الصفحة الرئيسية
// ─────────────────────────────────────────────────────────────
export default function Home() {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [sortBy, setSortBy] = useState<"new" | "top">("new");
  const [sharedClip, setSharedClip] = useState<any>(null);
  const { data: user } = useUser();
  const isAdmin = user?.role === "admin";

  // ── فتح كليب تلقائياً عند مشاركة رابط /?clip=:id ──────────
  const { data: approvedClips } = useClips({ status: "approved", sort: "new" });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clipId = params.get("clip");
    if (!clipId) return;
    window.history.replaceState({}, "", "/");
    const tryOpen = (clips: any[]) => {
      const clip = clips.find((c: any) => String(c.id) === clipId);
      if (clip) { setSharedClip(clip); setActiveSection("verified"); }
    };
    if (approvedClips?.length) { tryOpen(approvedClips); return; }
    fetch(`/api/clips/${clipId}`)
      .then(r => r.ok ? r.json() : null)
      .then(clip => { if (clip) { setSharedClip(clip); setActiveSection("verified"); } })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedClips]);

  const currentSection = SECTIONS.find((s) => s.id === activeSection);

  const goToSection = (id: SectionId) => {
    setActiveSection(id);
    setSortBy("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goHome = () => {
    setActiveSection(null);
    setSharedClip(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Layout>
      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════
            الصفحة الرئيسية — اختيار القسم
        ══════════════════════════════════════ */}
        {!activeSection && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
          >
            {/* Hero */}
            <div className="relative mb-12 text-center pt-6 pb-2">
              {/* ضوء خلفي علوي */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 70%)" }}
              />

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium mb-6"
                style={{ background: "rgba(168,85,247,0.08)", borderColor: "rgba(168,85,247,0.2)", color: "hsl(265,89%,75%)" }}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>منصة مجتمعية للمقاطع والإبداع</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 leading-tight"
              >
                اكتشف اللحظات{" "}
                <span
                  className="text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(135deg, hsl(265,89%,72%), hsl(190,90%,55%))" }}
                >
                  الملحمية
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-base text-muted-foreground max-w-lg mx-auto leading-relaxed"
              >
                اختر القسم الذي تريده — موثّق أو إبداعي أو مجتمعي
              </motion.p>
            </div>

            {/* بطاقات الأقسام الثلاثة */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
              {SECTIONS.map((section, i) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={i}
                  onClick={() => goToSection(section.id)}
                />
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/8" />
              <div className="flex items-center gap-2 text-xs text-white/25">
                <Star className="w-3 h-3" />
                <span>أحدث الكليبات الموثّقة</span>
                <Star className="w-3 h-3" />
              </div>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/8" />
            </div>

            {/* بريفيو سريع للكليبات الموثقة في الأسفل */}
            <QuickVerifiedPreview onViewAll={() => goToSection("verified")} isAdmin={isAdmin} />
          </motion.div>
        )}

        {/* ══════════════════════════════════════
            داخل القسم
        ══════════════════════════════════════ */}
        {activeSection && currentSection && (
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <SectionHeader
              section={currentSection}
              onBack={goHome}
              sortBy={sortBy}
              setSortBy={setSortBy}
            />

            {activeSection === "verified" && (
              <ClipsSection section={currentSection} status="approved" isAdmin={isAdmin} sortBy={sortBy} initialClip={sharedClip} />
            )}
            {activeSection === "community" && (
              <CommunitySection section={currentSection} isAdmin={isAdmin} sortBy={sortBy} />
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────
//  بريفيو سريع للكليبات الموثقة (في الصفحة الرئيسية)
// ─────────────────────────────────────────────────────────────
function QuickVerifiedPreview({ onViewAll, isAdmin }: { onViewAll: () => void; isAdmin: boolean }) {
  const [selectedClip, setSelected] = useState<any>(null);
  const openClip = useCallback((clip: any) => setSelected(clip), []);
  const closeClip = useCallback(() => setSelected(null), []);

  const { data: clips, isLoading } = useClips({ status: "approved", sort: "new" });
  const preview = clips?.slice(0, 4);

  return (
    <div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            {preview?.map((clip: any, i: number) => (
              <motion.div key={clip.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}>
                <ClipCard clip={clip} onPlay={() => openClip(clip)} isAdmin={isAdmin} />
              </motion.div>
            ))}
          </div>
          {clips && clips.length > 4 && (
            <div className="flex justify-center">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onViewAll}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-sm transition-all"
                style={{
                  background: "rgba(168,85,247,0.12)",
                  border: "1.5px solid rgba(168,85,247,0.3)",
                  color: "#a855f7",
                  boxShadow: "0 0 20px rgba(168,85,247,0.15)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(168,85,247,0.2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(168,85,247,0.12)"; }}
              >
                <ShieldCheck className="w-4 h-4" />
                عرض جميع الكليبات الموثّقة
                <ChevronRight className="w-4 h-4 rotate-180" />
              </motion.button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selectedClip && <GhostPlayer clip={selectedClip} onClose={closeClip} />}
      </AnimatePresence>
    </div>
  );
}
