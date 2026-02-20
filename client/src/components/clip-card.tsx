import { useState } from "react";
import { sfx } from "@/App";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ThumbsUp, ThumbsDown, Clock, Trash2, Share2, Check, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useVoteClip, useDeleteClip } from "@/hooks/use-clips";

const TAG_LABELS: Record<string, string> = {
  Funny: "😂 مضحك", Epic: "⚡ ملحمي",
  Glitch: "🐛 باج", Skill: "🎯 مهارة", Horror: "👻 مرعب",
};

const TAG_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  Funny:  { bg: "rgba(234,179,8,0.15)",  text: "#fbbf24", glow: "rgba(234,179,8,0.4)"  },
  Epic:   { bg: "rgba(59,130,246,0.15)", text: "#60a5fa", glow: "rgba(59,130,246,0.4)" },
  Glitch: { bg: "rgba(249,115,22,0.15)", text: "#fb923c", glow: "rgba(249,115,22,0.4)" },
  Skill:  { bg: "rgba(34,197,94,0.15)",  text: "#4ade80", glow: "rgba(34,197,94,0.4)"  },
  Horror: { bg: "rgba(239,68,68,0.15)",  text: "#f87171", glow: "rgba(239,68,68,0.4)"  },
};

const AVATAR_COLORS = ["#7c3aed","#2563eb","#059669","#d97706","#dc2626","#db2777","#0891b2","#ea580c"];
function nameToColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h << 5) - h + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function SubmitterAvatar({ clip }: { clip: any }) {
  const name = clip.submitterName || clip.submitter?.username || "زائر";
  const src  = clip.submitterAvatar || clip.submitter?.avatarUrl || null;
  const [failed, setFailed] = useState(false);
  const initial = name[0]?.toUpperCase() ?? "؟";
  if (src && !failed)
    return <img src={src} alt={name} onError={() => setFailed(true)} className="w-5 h-5 rounded-full flex-shrink-0 ring-1 ring-white/15 object-cover" />;
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 ring-1 ring-white/10"
      style={{ background: nameToColor(name) }}>{initial}</div>
  );
}

function VoteBtn({ type, count, active, onClick }: { type: "up"|"down"; count: number; active: boolean; onClick: () => void; }) {
  const up = type === "up";
  return (
    <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
      style={{
        background: active ? (up ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)") : "rgba(255,255,255,0.05)",
        color:      active ? (up ? "#4ade80" : "#f87171") : "rgba(255,255,255,0.35)",
        border: `1px solid ${active ? (up ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)") : "rgba(255,255,255,0.07)"}`,
      }}>
      {up ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
      <span className="font-mono tabular-nums text-[11px]">{count}</span>
    </motion.button>
  );
}

interface ClipCardProps { clip: any; onPlay?: () => void; isAdmin?: boolean; }

export function ClipCard({ clip, onPlay, isAdmin = false }: ClipCardProps) {
  const voteMutation   = useVoteClip();
  const deleteMutation = useDeleteClip();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hovered, setHovered]         = useState(false);
  const [imgError, setImgError]       = useState(false);
  const [userVote, setUserVote]       = useState<1|-1|null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const isKick = clip.platform === "kick" || /kick\.com/i.test(clip.url || "");

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/clips/${clip.id}`;
    try {
      if (navigator.share) await navigator.share({ title: clip.title, url });
      else { await navigator.clipboard.writeText(url); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }
    } catch {
      try { await navigator.clipboard.writeText(url); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); } catch {}
    }
  };

  const tag      = TAG_COLORS[clip.tag];
  const tagLabel = TAG_LABELS[clip.tag] ?? clip.tag;
  const name     = clip.submitterName || clip.submitter?.username || "زائر";

  const ups   = (clip.upvotes   || 0) + (userVote === 1  ? 1 : 0);
  const downs = (clip.downvotes || 0) + (userVote === -1 ? 1 : 0);
  const ratio = (ups + downs) > 0 ? (ups / (ups + downs)) * 100 : 50;

  const vote = (v: 1|-1) => {
    sfx.click();
    setUserVote(userVote === v ? null : v);
    voteMutation.mutate({ id: clip.id, value: v });
  };

  const hasThumbnail = !!clip.thumbnailUrl && !imgError;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, scale: 1.01 }} transition={{ duration: 0.2 }}
        onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}
        className="relative flex flex-col bg-[#0d0d10] rounded-2xl overflow-hidden border border-white/6 transition-all duration-300 group"
        style={{ boxShadow: hovered && tag ? `0 20px 50px -15px ${tag.glow}, 0 0 0 1px rgba(255,255,255,0.08)` : "0 4px 24px -6px rgba(0,0,0,0.6)" }}
      >
        {/* زر حذف الأدمن */}
        {isAdmin && (
          <button onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            className="absolute top-2.5 left-2.5 z-30 bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg shadow-red-900/40">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* ── Thumbnail ── */}
        <div className="relative cursor-pointer overflow-hidden" style={{ aspectRatio: "16/9" }} onClick={() => { sfx.open(); onPlay?.(); }}>

          {hasThumbnail ? (
            <img src={clip.thumbnailUrl} alt={clip.title} onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-700"
              style={{ transform: hovered ? "scale(1.07)" : "scale(1)" }} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2"
              style={{ background: tag ? `radial-gradient(ellipse at center, ${tag.bg} 0%, #0d0d10 70%)` : "linear-gradient(135deg,#1a1a2e,#0d0d10)" }}>
              <div className="text-4xl opacity-25">{isKick ? "🟢" : "📹"}</div>
              <p className="text-white/20 text-xs">لا تتوفر صورة مصغرة</p>
            </div>
          )}

          {/* gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

          {/* شارة المنصة */}
          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm"
            style={{
              background: isKick ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.6)",
              border: isKick ? "1px solid rgba(83,252,31,0.5)" : "1px solid rgba(255,60,60,0.5)",
              color: isKick ? "#53FC1F" : "#ff5555",
            }}>
            {isKick ? (
              <svg viewBox="0 0 32 32" className="w-2.5 h-2.5" fill="currentColor"><path d="M4 4h6v10l8-10h8L16 16l10 12h-8L10 18v10H4V4z"/></svg>
            ) : (
              <svg viewBox="0 0 90 63" className="w-3 h-2" fill="currentColor">
                <path d="M88.1 9.9C87 5.7 83.8 2.5 79.7 1.4 72.7 0 45 0 45 0S17.3 0 10.3 1.4C6.2 2.5 3 5.7 1.9 9.9 0 16.4 0 31.5 0 31.5s0 15.1 1.9 21.6c1.1 4.2 4.3 7.4 8.4 8.5C17.3 63 45 63 45 63s27.7 0 34.7-1.4c4.1-1.1 7.3-4.3 8.4-8.5C90 46.6 90 31.5 90 31.5s0-15.1-1.9-21.6z"/>
                <path d="M36 45l23.3-13.5L36 18z" fill="white"/>
              </svg>
            )}
            {isKick ? "Kick" : "YouTube"}
          </div>

          {/* زر Play على hover */}
          <AnimatePresence>
            {hovered && (
              <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(168,85,247,0.92)", boxShadow: "0 0 50px rgba(168,85,247,0.8),0 0 0 8px rgba(168,85,247,0.2)" }}>
                  <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* مدة الكليب */}
          {clip.duration && (
            <div className="absolute bottom-2.5 right-2.5 text-[10px] font-mono text-white font-bold bg-black/80 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
              {clip.duration}
            </div>
          )}

          {/* تصنيف الكليب */}
          {clip.tag && tag && (
            <div className="absolute bottom-2.5 left-2.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm"
                style={{ background: tag.bg, color: tag.text, borderColor: `${tag.text}50` }}>
                {tagLabel}
              </span>
            </div>
          )}

          {/* خط توهج عند hover */}
          <motion.div className="absolute bottom-0 left-0 right-0 h-0.5" animate={{ opacity: hovered ? 1 : 0 }}
            style={{ background: tag ? `linear-gradient(to right,transparent,${tag.glow},transparent)` : "transparent" }} />
        </div>

        {/* ── محتوى ── */}
        <div className="flex flex-col flex-1 p-3.5 gap-2">

          <h3 className="text-sm font-semibold leading-snug line-clamp-2 cursor-pointer transition-colors duration-200"
            style={{ color: hovered ? "hsl(var(--primary))" : "rgba(255,255,255,0.9)" }} onClick={() => { sfx.open(); onPlay?.(); }}>
            {clip.title}
          </h3>

          <div className="flex items-center gap-1.5 text-[11px] text-white/40">
            <SubmitterAvatar clip={clip} />
            <span className="truncate text-white/55 font-medium">{name}</span>
            <span className="text-white/20 mx-0.5">·</span>
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="flex-shrink-0 text-[10px]">
              {clip.createdAt ? formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true }) : "للتو"}
            </span>
          </div>

          {/* شريط نسبة التصويت */}
          <div className="h-0.5 rounded-full overflow-hidden bg-white/6">
            <motion.div className="h-full rounded-full" transition={{ duration: 0.5 }}
              style={{ width: `${ratio}%`, background: ratio > 60 ? "#22c55e" : ratio < 40 ? "#ef4444" : "#a855f7" }} />
          </div>

          {/* أزرار */}
          <div className="flex items-center gap-1.5 mt-auto pt-0.5">
            <VoteBtn type="up"   count={ups}   active={userVote === 1}  onClick={() => vote(1)}  />
            <VoteBtn type="down" count={downs} active={userVote === -1} onClick={() => vote(-1)} />

            <motion.button whileTap={{ scale: 0.93 }} onClick={handleShare}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all border"
              style={{
                background: shareCopied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                borderColor: shareCopied ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.07)",
                color: shareCopied ? "#4ade80" : "rgba(255,255,255,0.3)",
              }}>
              {shareCopied ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
            </motion.button>

            <a href={clip.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all border"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}>
              <ExternalLink className="w-3 h-3" />
            </a>

            <motion.button whileTap={{ scale: 0.93 }} onClick={() => { sfx.open(); onPlay?.(); }}
              className="mr-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
              style={{
                background: "rgba(168,85,247,0.12)", borderColor: "rgba(168,85,247,0.3)",
                color: "hsl(var(--primary))", boxShadow: hovered ? "0 0 16px rgba(168,85,247,0.25)" : "none",
              }}>
              <Play className="w-3 h-3" fill="currentColor" /> شاهد
            </motion.button>
          </div>
        </div>
      </motion.div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المقطع</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف <strong>"{clip.title}"</strong>؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(clip.id, { onSuccess: () => setConfirmOpen(false) })}
              className="bg-red-600 hover:bg-red-700 text-white" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "جاري الحذف..." : "نعم، احذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
