import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ThumbsUp, ThumbsDown, Clock, User, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useVoteClip, useDeleteClip } from "@/hooks/use-clips";

interface ClipCardProps {
  clip: any;
  onPlay?: () => void;
  isAdmin?: boolean;
}

export function ClipCard({ clip, onPlay, isAdmin = false }: ClipCardProps) {
  const voteMutation   = useVoteClip();
  const deleteMutation = useDeleteClip();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleVote = (value: number) => {
    voteMutation.mutate({ id: clip.id, value });
  };

  const handleDelete = () => {
    deleteMutation.mutate(clip.id, {
      onSuccess: () => setConfirmOpen(false),
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5 }}
        transition={{ duration: 0.3 }}
        className="group relative bg-card rounded-xl overflow-hidden border border-border/50 shadow-lg hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:border-primary/50 transition-all"
      >
        {/* ── زر الحذف — يظهر فقط للأدمن عند hover ── */}
        <AnimatePresence>
          {isAdmin && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
              className="absolute top-2 left-2 z-20 bg-red-600/90 hover:bg-red-600 text-white p-1.5 rounded-lg shadow-lg backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
              title="حذف المقطع"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Thumbnail */}
        <div
          className="relative aspect-video bg-black/50 overflow-hidden cursor-pointer"
          onClick={onPlay}
        >
          <img
            src={clip.thumbnailUrl}
            alt={clip.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

          {/* Play Button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)] backdrop-blur-sm transform group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
            </div>
          </div>

          {/* Duration Badge */}
          <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md px-2 py-1 rounded-md text-xs font-mono font-medium border border-white/10">
            {clip.duration}
          </div>

          {clip.status !== "approved" && (
            <div className="absolute top-3 left-3">
              <Badge variant={clip.status === "pending" ? "secondary" : "destructive"}>
                {clip.status}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <h3 className="font-display font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {clip.title}
          </h3>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="w-6 h-6 ring-1 ring-border">
              <AvatarImage src={clip.submitter?.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-[10px] text-primary font-bold">
                {(clip.submitterName || clip.submitter?.username || "؟").slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[120px]">
              {clip.submitterName || clip.submitter?.username || "زائر"}
            </span>
            <span className="mx-1">•</span>
            <Clock className="w-3 h-3" />
            <span>
              {clip.createdAt
                ? formatDistanceToNow(new Date(clip.createdAt), { addSuffix: true })
                : "للتو"}
            </span>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-border/50 mt-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 hover:bg-primary/10 hover:text-primary"
                onClick={() => handleVote(1)}
              >
                <ThumbsUp className="w-4 h-4 mr-1.5" />
                <span className="font-mono font-medium">{clip.upvotes}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleVote(-1)}
              >
                <ThumbsDown className="w-4 h-4 mr-1.5" />
                <span className="font-mono font-medium">{clip.downvotes}</span>
              </Button>
            </div>
            <Badge variant="outline" className="font-normal text-xs bg-secondary/5 text-secondary border-secondary/20">
              {clip.tag}
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* ── نافذة تأكيد الحذف ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المقطع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف <strong>"{clip.title}"</strong>؟
              <br />
              هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
