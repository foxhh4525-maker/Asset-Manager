import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ThumbsUp, ThumbsDown, Clock, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Funny:  "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Epic:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Glitch: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Skill:  "bg-green-500/20 text-green-300 border-green-500/30",
  Horror: "bg-red-500/20 text-red-300 border-red-500/30",
};

// ── توليد أفاتار من الاسم — بدون صور خارجية ─────────────────
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

export function ClipCard({ clip, onPlay, isAdmin = false }: ClipCardProps) {
  const voteMutation   = useVoteClip();
  const deleteMutation = useDeleteClip();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const displayName = clip.submitterName || clip.submitter?.username || "زائر";
  const tagLabel    = TAG_LABELS[clip.tag] ?? clip.tag;
  const tagColor    = TAG_COLORS[clip.tag] ?? "bg-primary/20 text-primary border-primary/30";
  const avatarColor = nameColor(displayName);
  const avatarLetter= nameInitial(displayName);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.25 }}
        className="group relative bg-card rounded-xl overflow-hidden border border-border/50 shadow-lg hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:border-primary/50 transition-all"
      >
        {/* زر الحذف - للأدمن فقط */}
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            className="absolute top-2 left-2 z-20 bg-red-600/90 hover:bg-red-600 text-white p-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Thumbnail */}
        <div className="relative aspect-video bg-black/50 overflow-hidden cursor-pointer" onClick={onPlay}>
          {clip.thumbnailUrl ? (
            <img
              src={clip.thumbnailUrl}
              alt={clip.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/20">
              <Play className="w-10 h-10 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* زر Play */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)]">
              <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
            </div>
          </div>

          {/* مدة الكليب */}
          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs font-mono border border-white/10">
            {clip.duration}
          </div>

          {/* ✅ تصنيف الكليب فوق الصورة - يظهر دائماً */}
          {clip.tag && (
            <div className="absolute top-2 right-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${tagColor}`}>
                {tagLabel}
              </span>
            </div>
          )}
        </div>

        {/* معلومات الكليب */}
        <div className="p-4 space-y-3">
          <h3 className="font-display font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {clip.title}
          </h3>

          {/* ✅ المرسِل — أفاتار مبني من الاسم (لا يعتمد على صور خارجية) */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-2 ring-white/10"
              style={{ backgroundColor: avatarColor }}
            >
              {avatarLetter}
            </div>
            <span className="truncate font-medium text-foreground/80">{displayName}</span>
            <span className="text-muted-foreground/40 mx-0.5">•</span>
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="text-xs">
              {clip.createdAt
                ? formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })
                : "للتو"}
            </span>
          </div>

          {/* أزرار التصويت */}
          <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-1">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="sm"
                className="h-8 px-2 hover:bg-primary/10 hover:text-primary"
                onClick={() => voteMutation.mutate({ id: clip.id, value: 1 })}
              >
                <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                <span className="font-mono text-xs">{clip.upvotes}</span>
              </Button>
              <Button
                variant="ghost" size="sm"
                className="h-8 px-2 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => voteMutation.mutate({ id: clip.id, value: -1 })}
              >
                <ThumbsDown className="w-3.5 h-3.5 mr-1" />
                <span className="font-mono text-xs">{clip.downvotes}</span>
              </Button>
            </div>

            {/* ✅ تصنيف في أسفل البطاقة أيضاً */}
            {clip.tag && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tagColor}`}>
                {tagLabel}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* نافذة تأكيد الحذف */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
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
