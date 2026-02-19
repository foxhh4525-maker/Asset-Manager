import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ThumbsUp, ThumbsDown, Clock, Trash2 } from "lucide-react";
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
  Funny:  { bg: "rgba(234,179,8,0.12)",  text: "#fbbf24", glow: "rgba(234,179,8,0.35)"  },
  Epic:   { bg: "rgba(59,130,246,0.12)", text: "#60a5fa", glow: "rgba(59,130,246,0.35)" },
  Glitch: { bg: "rgba(249,115,22,0.12)", text: "#fb923c", glow: "rgba(249,115,22,0.35)" },
  Skill:  { bg: "rgba(34,197,94,0.12)",  text: "#4ade80", glow: "rgba(34,197,94,0.35)"  },
  Horror: { bg: "rgba(239,68,68,0.12)",  text: "#f87171", glow: "rgba(239,68,68,0.35)"  },
};

const AVATAR_COLORS = [
  "#7c3aed","#2563eb","#059669","#d97706",
  "#dc2626","#db2777","#0891b2","#ea580c",
];
function nameToColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h << 5) - h + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/** أفاتار المُرسِل: صورة مخصصة أو حرف أول ملوّن */
function SubmitterAvatar({ clip }: { clip: any }) {
  const name = clip.submitterName || clip.submitter?.username || "زائر";
  const src  = clip.submitterAvatar || clip.submitter?.avatarUrl || null;
  const [failed, setFailed] = useState(false);

  const initial   = name[0]?.toUpperCase() ?? "؟";
  const bgColor   = nameToColor(name);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="w-6 h-6 rounded-full flex-shrink-0 ring-1 ring-white/10 object-cover"
      />
    );
  }

  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ring-1 ring-white/10"
      style={{ background: bgColor }}
    >
      {initial}
    </div>
  );
}

function VoteBtn({ type, count, active, onClick }: {
  type: "up" | "down"; count: number; active: boolean; onClick: () => void;
}) {
  const up = type === "up";
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
      style={{
        background: active ? (up ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)") : "rgba(255,255,255,0.04)",
        color:      active ? (up ? "#4ade80" : "#f87171") : "rgba(255,255,255,0.35)",
        border: `1px solid ${active
          ? (up ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)")
          : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {up ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
      <span className="font-mono tabular-nums">{count}</span>
    </motion.button>
  );
}

interface ClipCardProps { clip: any; onPlay?: () => void; isAdmin?: boolean; }

export function ClipCard({ clip, onPlay, isAdmin = false }: ClipCardProps) {
  const voteMutation   = useVoteClip();
  const deleteMutation = useDeleteClip();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hovered, setHovered]         = useState(false);
  const [userVote, setUserVote]       = useState<1 | -1 | null>(null);

  const tag      = TAG_COLORS[clip.tag];
  const tagLabel = TAG_LABELS[clip.tag] ?? clip.tag;
  const name     = clip.submitterName || clip.submitter?.username || "زائر";

  // Optimistic vote counts
  const ups   = (clip.upvotes   || 0) + (userVote === 1  ? 1 : 0);
  const downs = (clip.downvotes || 0) + (userVote === -1 ? 1 : 0);
  const total = ups + downs;
  const ratio = total > 0 ? (ups / total) * 100 : 50;

  const vote = (v: 1 | -1) => {
    if (userVote === v) return;
    setUserVote(v);
    voteMutation.mutate({ id: clip.id, value: v });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5, scale: 1.01 }} transition={{ duration: 0.2 }}
        onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}
        className="relative flex flex-col bg-[#0d0d10] rounded-2xl overflow-hidden border border-white/5 transition-all duration-300"
        style={{
          boxShadow: hovered && tag
            ? `0 20px 50px -15px ${tag.glow}, 0 0 0 1px rgba(255,255,255,0.07)`
            : "0 4px 20px -5px rgba(0,0,0,0.5)",
        }}
      >
        {/* Admin delete */}
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            className="absolute top-2.5 left-2.5 z-20 bg-red-600/80 hover:bg-red-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Thumbnail */}
        <div className="relative aspect-video bg-black cursor-pointer overflow-hidden" onClick={onPlay}>
          {clip.thumbnailUrl ? (
            <>
              <img
                src={clip.thumbnailUrl} alt={clip.title}
                className="w-full h-full object-cover transition-transform duration-700"
                style={{ transform: hovered ? "scale(1.08)" : "scale(1)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-10 h-10 text-white/20" />
            </div>
          )}

          {/* Play overlay */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(168,85,247,0.9)", boxShadow: "0 0 40px rgba(168,85,247,0.7)" }}
                >
                  <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Duration */}
          {clip.duration && (
            <div className="absolute bottom-2 left-2 text-[10px] font-mono text-white/70 bg-black/70 px-1.5 py-0.5 rounded-md">
              {clip.duration}
            </div>
          )}

          {/* Tag */}
          {clip.tag && tag && (
            <div className="absolute top-2.5 right-2.5">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                style={{ background: tag.bg, color: tag.text, borderColor: `${tag.text}40` }}
              >
                {tagLabel}
              </span>
            </div>
          )}

          {/* Hover accent line */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-px"
            animate={{ opacity: hovered ? 1 : 0 }}
            style={{ background: tag ? `linear-gradient(to right, transparent, ${tag.glow}, transparent)` : undefined }}
          />
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-3.5 gap-2.5">
          <h3
            className="text-sm font-semibold leading-snug line-clamp-2 cursor-pointer transition-colors"
            style={{ color: hovered ? "hsl(var(--primary))" : "rgba(255,255,255,0.9)" }}
            onClick={onPlay}
          >
            {clip.title}
          </h3>

          {/* Submitter */}
          <div className="flex items-center gap-1.5 text-[11px] text-white/40">
            <SubmitterAvatar clip={clip} />
            <span className="truncate text-white/55 font-medium">{name}</span>
            <span className="text-white/20 mx-0.5">•</span>
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="flex-shrink-0">
              {clip.createdAt
                ? formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })
                : "للتو"}
            </span>
          </div>

          {/* Vote ratio bar */}
          <div className="h-0.5 rounded-full overflow-hidden bg-white/5">
            <motion.div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${ratio}%`,
                background: ratio > 60 ? "#22c55e" : ratio < 40 ? "#ef4444" : "#a855f7",
              }}
            />
          </div>

          {/* Action row */}
          <div className="flex items-center gap-1.5 mt-auto pt-0.5">
            <VoteBtn type="up"   count={ups}   active={userVote === 1}  onClick={() => vote(1)}  />
            <VoteBtn type="down" count={downs} active={userVote === -1} onClick={() => vote(-1)} />
            <motion.button
              whileTap={{ scale: 0.93 }} onClick={onPlay}
              className="mr-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
              style={{ background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.25)", color: "hsl(var(--primary))" }}
            >
              <Play className="w-3 h-3" fill="currentColor" /> شاهد
            </motion.button>
          </div>
        </div>
      </motion.div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المقطع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف <strong>"{clip.title}"</strong>؟ لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(clip.id, { onSuccess: () => setConfirmOpen(false) })}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "نعم، احذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
