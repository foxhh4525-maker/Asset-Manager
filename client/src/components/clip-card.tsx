import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ThumbsUp, ThumbsDown, Clock, Trash2, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useVoteClip, useDeleteClip } from "@/hooks/use-clips";

// ── ترجمة التصنيفات ──────────────────────────────────────────
const TAG_LABELS: Record<string, string> = {
  Funny:  "😂 مضحك",
  Epic:   "⚡ ملحمي",
  Glitch: "🐛 باج",
  Skill:  "🎯 مهارة",
  Horror: "👻 مرعب",
};

const TAG_COLORS: Record<string, string> = {
  Funny:  "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  Epic:   "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Glitch: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Skill:  "bg-green-500/15 text-green-300 border-green-500/30",
  Horror: "bg-red-500/15 text-red-300 border-red-500/30",
};

const TAG_GLOW: Record<string, string> = {
  Funny:  "rgba(234,179,8,0.3)",
  Epic:   "rgba(59,130,246,0.3)",
  Glitch: "rgba(249,115,22,0.3)",
  Skill:  "rgba(34,197,94,0.3)",
  Horror: "rgba(239,68,68,0.3)",
};

// ── توليد أفاتار من الاسم ─────────────────────────────────────
const AVATAR_COLORS = [
  "#7c3aed","#2563eb","#059669","#d97706","#dc2626","#db2777","#0891b2",
];
function nameColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash << 5) - hash + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function nameInitial(name: string): string {
  return name?.trim().slice(0, 1) || "؟";
}

interface ClipCardProps {
  clip: any;
  onPlay?: () => void;
  isAdmin?: boolean;
}

const failedAvatarUrls = new Set<string>();

function SubmitterAvatar({ clip }: { clip: any }) {
  const displayName  = clip.submitterName || clip.submitter?.username || "زائر";
  const avatarSrc    = clip.submitterAvatar || clip.submitter?.avatarUrl || null;
  const avatarColor  = nameColor(displayName);
  const avatarLetter = nameInitial(displayName);
  const [failed, setFailed] = useState(() => !!avatarSrc && failedAvatarUrls.has(avatarSrc));

  const handleError = () => {
    if (avatarSrc) failedAvatarUrls.add(avatarSrc);
    setFailed(true);
  };

  if (avatarSrc && !failed) {
    return (
      <img
        src={avatarSrc}
        alt={displayName}
        onError={handleError}
        className="w-6 h-6 rounded-full flex-shrink-0 ring-2 ring-primary/20 object-cover"
      />
    );
  }

  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ring-1 ring-white/10"
      style={{ backgroundColor: avatarColor }}
    >
      {avatarLetter}
    </div>
  );
}

export function ClipCard({ clip, onPlay, isAdmin = false }: ClipCardProps) {
  const voteMutation   = useVoteClip();
  const deleteMutation = useDeleteClip();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const displayName = clip.submitterName || clip.submitter?.username || "زائر";
  const tagLabel    = TAG_LABELS[clip.tag] ?? clip.tag;
  const tagColor    = TAG_COLORS[clip.tag] ?? "bg-primary/15 text-primary border-primary/30";
  const tagGlow     = TAG_GLOW[clip.tag] ?? "rgba(168,85,247,0.3)";

  const totalVotes = (clip.upvotes || 0) + (clip.downvotes || 0);
  const voteRatio  = totalVotes > 0 ? ((clip.upvotes || 0) / totalVotes) * 100 : 50;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -6, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="group relative bg-[#0d0d10] rounded-2xl overflow-hidden border border-white/5 shadow-lg transition-all duration-300"
        style={{
          boxShadow: isHovered
            ? `0 20px 60px -15px ${tagGlow}, 0 0 0 1px rgba(255,255,255,0.08)`
            : "0 4px 20px -5px rgba(0,0,0,0.5)",
        }}
      >
        {/* زر الحذف */}
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            className="absolute top-3 left-3 z-20 bg-red-600/80 hover:bg-red-600 backdrop-blur text-white p-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Thumbnail */}
        <div
          className="relative aspect-video bg-black/60 overflow-hidden cursor-pointer"
          onClick={onPlay}
        >
          {clip.thumbnailUrl ? (
            <>
              <img
                src={clip.thumbnailUrl}
                alt={clip.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              {/* تدرج فوق الصورة */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/20">
              <Play className="w-10 h-10 text-muted-foreground/40" />
            </div>
          )}

          {/* زر Play - دائرة كبيرة في المنتصف */}
          <motion.div
            initial={false}
            animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-sm"
              style={{
                background: "rgba(168,85,247,0.85)",
                boxShadow: `0 0 40px rgba(168,85,247,0.6), 0 0 80px rgba(168,85,247,0.3)`,
              }}
            >
              <Play className="w-7 h-7 text-white ml-1" fill="currentColor" />
            </div>
          </motion.div>

          {/* مدة الكليب */}
          {clip.duration && (
            <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-mono text-white/80 border border-white/10">
              {clip.duration}
            </div>
          )}

          {/* تصنيف الكليب */}
          {clip.tag && (
            <div className="absolute top-2.5 right-2.5">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full border backdrop-blur-sm ${tagColor}`}>
                {tagLabel}
              </span>
            </div>
          )}

          {/* مؤشر "اضغط لتشغيل" خط سفلي */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: `linear-gradient(to right, transparent, ${tagGlow.replace("0.3", "0.8")}, transparent)` }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* معلومات الكليب */}
        <div className="p-4 space-y-3">
          {/* العنوان */}
          <h3
            className="font-semibold text-sm leading-snug line-clamp-2 cursor-pointer transition-colors"
            style={{ color: isHovered ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}
            onClick={onPlay}
          >
            {clip.title}
          </h3>

          {/* المرسِل والوقت */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SubmitterAvatar clip={clip} />
            <span className="truncate font-medium text-foreground/70 max-w-[120px]">{displayName}</span>
            <span className="text-muted-foreground/30">•</span>
            <Clock className="w-3 h-3 flex-shrink-0 text-muted-foreground/60" />
            <span className="text-muted-foreground/60 flex-shrink-0">
              {clip.createdAt
                ? formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })
                : "للتو"}
            </span>
          </div>

          {/* شريط التصويت */}
          {totalVotes > 0 && (
            <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${voteRatio}%`,
                  background: voteRatio > 60
                    ? "linear-gradient(to right, #22c55e, #86efac)"
                    : voteRatio < 40
                    ? "linear-gradient(to right, #ef4444, #fca5a5)"
                    : "linear-gradient(to right, #a855f7, #c084fc)",
                }}
              />
            </div>
          )}

          {/* أزرار التصويت */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-green-500/10 hover:text-green-400 text-muted-foreground group/up"
                onClick={(e) => { e.stopPropagation(); voteMutation.mutate({ id: clip.id, value: 1 }); }}
              >
                <ThumbsUp className="w-3.5 h-3.5 group-hover/up:scale-110 transition-transform" />
                <span className="font-mono">{clip.upvotes || 0}</span>
              </button>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 text-muted-foreground group/down"
                onClick={(e) => { e.stopPropagation(); voteMutation.mutate({ id: clip.id, value: -1 }); }}
              >
                <ThumbsDown className="w-3.5 h-3.5 group-hover/down:scale-110 transition-transform" />
                <span className="font-mono">{clip.downvotes || 0}</span>
              </button>
            </div>

            {/* زر مشاهدة صغير */}
            <button
              onClick={onPlay}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-200 border border-primary/20 hover:border-primary/40"
            >
              <Play className="w-3 h-3" fill="currentColor" />
              شاهد
            </button>
          </div>
        </div>
      </motion.div>

      {/* نافذة تأكيد الحذف */}
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
