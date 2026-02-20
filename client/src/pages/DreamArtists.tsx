import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useUser } from "@/hooks/use-auth";
import { X, Loader2, Trash2, CheckCircle, XCircle, Clock, Star, Palette, Send, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const failedArtworkAvatars = new Set<string>();

function ArtistAvatar({ art, size = "sm" }: { art: Artwork; size?: "sm" | "md" | "lg" }) {
  const hue = art.artistName.charCodeAt(0) * 37 % 360;
  const [failed, setFailed] = useState(() => !!art.artistAvatar && failedArtworkAvatars.has(art.artistAvatar));
  const handleError = () => { if (art.artistAvatar) failedArtworkAvatars.add(art.artistAvatar); setFailed(true); };
  const sizeMap = {
    sm: "w-8 h-8 rounded-full border border-purple-500/30 text-xs",
    md: "w-12 h-12 rounded-2xl border border-purple-500/30 text-sm",
    lg: "w-14 h-14 rounded-full border-2 border-purple-500/50 text-xl",
  };
  if (art.artistAvatar && !failed) {
    return <img src={art.artistAvatar} alt={art.artistName} onError={handleError} className={`${sizeMap[size]} flex-shrink-0 object-cover bg-[#0d0d1a]`} />;
  }
  return (
    <div className={`${sizeMap[size]} flex-shrink-0 flex items-center justify-center text-white font-black`} style={{ background: `hsl(${hue}, 60%, 35%)` }}>
      {art.artistName[0]}
    </div>
  );
}

interface Artwork {
  id: number; imageData: string; artistName: string; artistAvatar: string | null;
  status: "pending" | "approved" | "rejected"; createdAt: string;
}
interface RatingStats {
  avg: number; count: number; breakdown: number[];
}

function useArtworks(status = "approved") {
  return useQuery<Artwork[]>({
    queryKey: ["/api/artworks", status],
    queryFn: async () => {
      const r = await fetch(`/api/artworks?status=${status}`);
      if (!r.ok) throw new Error(`Failed to load artworks: ${r.status}`);
      return r.json();
    },
    staleTime: 0, refetchOnMount: true,
  });
}

function useArtworkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approved" | "rejected" | "delete" }) => {
      if (action === "delete") return fetch(`/api/artworks/${id}`, { method: "DELETE" });
      return fetch(`/api/artworks/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: action }) });
    },
    onSuccess: () => {
      // Invalidate any artworks list and related ratings so UI refreshes.
      qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && String(q.queryKey[0]) === "/api/artworks" });
      qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && String(q.queryKey[0]) === "/api/artworks/ratings" });
    },
  });
}

function useRatingStats(artworkId: number | null) {
  return useQuery<RatingStats>({
    queryKey: ["/api/artworks/ratings", artworkId],
    queryFn: async () => {
      const r = await fetch(`/api/artworks/${artworkId}/ratings`);
      if (!r.ok) throw new Error(`Failed to load ratings: ${r.status}`);
      return r.json();
    },
    enabled: artworkId !== null, staleTime: 30_000,
  });
}

function useSubmitRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, any> }) =>
      fetch(`/api/artworks/${id}/ratings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async r => {
        if (!r.ok) throw new Error(`Failed to submit rating: ${r.status}`);
        return r.json();
      }),
    onSuccess: (_d, { id }) => qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && String(q.queryKey[0]) === "/api/artworks/ratings" && q.queryKey[1] === id }),
  });
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => {
        const filled = i <= Math.floor(rating);
        const half = !filled && i - 0.5 <= rating;
        return <Star key={i} style={{ width: size, height: size }} className={filled ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]" : half ? "text-yellow-400 fill-yellow-400/50" : "text-white/10 fill-white/5"} />;
      })}
    </span>
  );
}

function RatingBadge({ artworkId }: { artworkId: number }) {
  const { data } = useRatingStats(artworkId);
  if (!data || data.count === 0) return <span className="flex items-center gap-1 text-white/30 text-[10px]"><Star className="w-3 h-3" /> لا يوجد تقييم</span>;
  return (
    <span className="flex items-center gap-1.5">
      <StarRow rating={data.avg} size={11} />
      <span className="text-yellow-400 font-bold text-xs">{data.avg.toFixed(1)}</span>
      <span className="text-white/40 text-[10px]">({data.count})</span>
    </span>
  );
}

const RATING_LABELS: Record<number, { text: string; color: string }> = {
  1: { text: "😞 سيء جداً", color: "#EF4444" }, 2: { text: "😕 سيء", color: "#F97316" },
  3: { text: "😐 مقبول", color: "#EAB308" }, 4: { text: "😊 جيد جداً", color: "#22C55E" },
  5: { text: "🤩 رائع!", color: "#FFD700" },
};

function StarPicker({ value, onChange, size = 40 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex gap-1 justify-center" dir="ltr">
      {[1,2,3,4,5].map(i => (
        <motion.button key={i} type="button" whileTap={{ scale: 0.8 }}
          animate={i <= active ? { scale: [1, 1.3, 1] } : { scale: 1 }} transition={{ duration: 0.25 }}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => onChange(i)} className="p-1 rounded-lg focus:outline-none">
          <Star style={{ width: size, height: size }}
            className={i <= active ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.7)] transition-all" : "text-white/15 fill-white/5 transition-all"} />
        </motion.button>
      ))}
    </div>
  );
}

function CatStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5" dir="ltr">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)} className="p-0.5 focus:outline-none">
          <Star className={`w-4 h-4 transition-all ${i <= value ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]" : "text-white/15 fill-white/5"}`} />
        </button>
      ))}
    </div>
  );
}

function BreakdownBars({ stats }: { stats: RatingStats }) {
  const total = stats.count || 1;
  return (
    <div className="flex gap-3 items-center">
      <div className="text-center flex-shrink-0">
        <div className="text-4xl font-black text-yellow-400 leading-none">{stats.avg.toFixed(1)}</div>
        <div className="text-white/40 text-xs mt-1">من 5</div>
        <StarRow rating={stats.avg} size={10} />
      </div>
      <div className="flex-1 space-y-1.5">
        {[5,4,3,2,1].map(star => {
          const count = stats.breakdown[star - 1] || 0;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-white/40 text-[10px] w-2 text-center">{star}</span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: (5 - star) * 0.1, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400" />
              </div>
              <span className="text-white/30 text-[10px] w-5 text-left">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RatingModal({ art, onClose }: { art: Artwork; onClose: () => void }) {
  const [overall, setOverall] = useState(0);
  const [quality, setQuality] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [valueScore, setValueScore] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { data: stats } = useRatingStats(art.id);
  const submitMutation = useSubmitRating();

  const handleSubmit = async () => {
    if (!overall) return;
    await submitMutation.mutateAsync({ id: art.id, data: { overall, quality: quality||null, speed: speed||null, communication: communication||null, value: valueScore||null, comment } });
    setSubmitted(true);
  };

  useEffect(() => { if (!submitted) return; const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [submitted]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-md bg-[#16162a] border border-purple-500/30 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 sm:hidden"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
        {submitted ? (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center p-10 gap-4">
            <motion.div animate={{ rotate: [0,-10,10,-5,5,0], scale: [1,1.3,1] }} transition={{ duration: 0.6 }} className="text-6xl">🎉</motion.div>
            <h3 className="text-xl font-black text-white">شكراً على تقييمك!</h3>
            <p className="text-white/50 text-sm text-center">تم إرسال تقييمك بنجاح ✨</p>
            <StarRow rating={overall} size={20} />
          </motion.div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <ArtistAvatar art={art} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-base truncate">{art.artistName}</p>
                <p className="text-purple-400 text-xs flex items-center gap-1 mt-0.5"><Palette className="w-3 h-3" /> فنان رسامين دريم</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            {stats && stats.count > 0 && (
              <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-2xl p-4">
                <p className="text-white/40 text-xs mb-3">التقييمات الحالية ({stats.count} تقييم)</p>
                <BreakdownBars stats={stats} />
              </div>
            )}
            <div className="text-center space-y-3">
              <p className="text-white/60 text-sm font-medium">ما هو تقييمك الإجمالي؟</p>
              <StarPicker value={overall} onChange={setOverall} size={44} />
              {overall > 0 && (
                <motion.p key={overall} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-base font-bold" style={{ color: RATING_LABELS[overall]?.color }}>
                  {RATING_LABELS[overall]?.text}
                </motion.p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: "🎨 جودة الرسم", val: quality, set: setQuality },
                { label: "⚡ سرعة التسليم", val: speed, set: setSpeed },
                { label: "💬 التواصل", val: communication, set: setCommunication },
                { label: "💰 قيمة السعر", val: valueScore, set: setValueScore },
              ] as const).map(({ label, val, set }) => (
                <div key={label} className="bg-white/3 border border-white/8 rounded-xl p-3">
                  <p className="text-white/50 text-[11px] mb-2">{label}</p>
                  <CatStars value={val} onChange={set as (v: number) => void} />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-white/50 text-xs flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> تعليق (اختياري)</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="اكتب تعليقك هنا..." maxLength={300} rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-purple-500/50 transition-colors font-sans" dir="rtl" />
              <p className="text-white/20 text-[10px] text-left">{comment.length}/300</p>
            </div>
            <div className="flex gap-3 pb-2">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all text-sm font-bold">إلغاء</button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={handleSubmit} disabled={!overall || submitMutation.isPending}
                className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all">
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> إرسال التقييم</>}
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ArtCard({ art, onOpen, onRate, isAdmin, onAction }: {
  art: Artwork; onOpen: (a: Artwork) => void; onRate: (a: Artwork) => void;
  isAdmin: boolean; onAction?: (id: number, action: "approved" | "rejected" | "delete") => void;
}) {
  const timeAgo = (iso: string) => {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 60) return "للتو";
    if (d < 3600) return `${Math.floor(d / 60)} دقيقة`;
    if (d < 86400) return `${Math.floor(d / 3600)} ساعة`;
    return `${Math.floor(d / 86400)} يوم`;
  };
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -10 }} whileHover={{ y: -4 }} transition={{ duration: 0.3 }}
      className="group relative bg-[#12121e] rounded-2xl overflow-hidden border border-white/8 hover:border-purple-500/40 transition-all shadow-xl hover:shadow-[0_0_25px_rgba(168,85,247,0.12)]">
      <div className="relative aspect-[3/2] overflow-hidden bg-[#0d0d1a] cursor-pointer" onClick={() => onOpen(art)}>
        <img src={art.imageData} alt={`رسمة ${art.artistName}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#12121e]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-purple-600/90 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur-sm shadow-lg">عرض الرسمة</div>
        </div>
        {art.status === "pending" && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-300 text-[11px] font-bold">قيد المراجعة</span>
          </div>
        )}
        {isAdmin && onAction && (
          <div className="absolute top-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            {art.status === "pending" && (
              <>
                <button onClick={() => onAction(art.id, "approved")} className="w-8 h-8 bg-green-600/90 hover:bg-green-600 rounded-lg flex items-center justify-center text-white shadow-lg transition-colors"><CheckCircle className="w-4 h-4" /></button>
                <button onClick={() => onAction(art.id, "rejected")} className="w-8 h-8 bg-red-600/90 hover:bg-red-600 rounded-lg flex items-center justify-center text-white shadow-lg transition-colors"><XCircle className="w-4 h-4" /></button>
              </>
            )}
            <button onClick={() => onAction(art.id, "delete")} className="w-8 h-8 bg-red-900/90 hover:bg-red-900 rounded-lg flex items-center justify-center text-white shadow-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ArtistAvatar art={art} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{art.artistName}</p>
            <p className="text-white/35 text-xs flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {timeAgo(art.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <RatingBadge artworkId={art.id} />
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onRate(art)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold hover:bg-yellow-500/20 hover:border-yellow-500/40 transition-all flex-shrink-0">
            <Star className="w-3 h-3 fill-yellow-400" /> قيّم
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function ArtViewer({ art, onClose, onRate }: { art: Artwork; onClose: () => void; onRate: (a: Artwork) => void }) {
  const { data: stats } = useRatingStats(art.id);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", damping: 20 }} className="w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="bg-[#12121e] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <img src={art.imageData} alt={`رسمة ${art.artistName}`} className="w-full object-contain max-h-[60vh] sm:max-h-[65vh]" />
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <ArtistAvatar art={art} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-lg sm:text-xl truncate">{art.artistName}</p>
                <p className="text-purple-400 text-xs sm:text-sm flex items-center gap-1 mt-0.5"><Star className="w-3.5 h-3.5" /> فنان رسامين دريم</p>
              </div>
            </div>
            {stats && stats.count > 0 && (
              <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-3 sm:p-4 mb-4">
                <p className="text-white/40 text-xs mb-3">إجمالي التقييمات ({stats.count})</p>
                <BreakdownBars stats={stats} />
              </div>
            )}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => { onClose(); setTimeout(() => onRate(art), 150); }}
              className="w-full py-3 sm:py-3.5 rounded-xl bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 text-yellow-400 font-black text-sm sm:text-base flex items-center justify-center gap-2 hover:from-yellow-500/30 hover:to-yellow-600/30 transition-all">
              <Star className="w-4 h-4 fill-yellow-400" /> قيّم هذه الرسمة
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function DreamArtists() {
  const { data: user } = useUser();
  const isAdmin = user?.role === "admin";
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [ratingTarget, setRatingTarget] = useState<Artwork | null>(null);
  const action = useArtworkAction();
  const { data: artworks = [], isLoading, error } = useArtworks("approved");

  const handleAction = useCallback((id: number, act: "approved" | "rejected" | "delete") => {
    action.mutate({ id, action: act });
  }, [action]);

  // If error, show error state instead of black screen
  if (error) return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white mb-2">حدث خطأ</h2>
        <p className="text-white/50 text-sm mb-6">تعذّر تحميل الرسومات</p>
        <button onClick={() => window.location.reload()} className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors">
          إعادة المحاولة
        </button>
      </div>
    </Layout>
  );

  return (
    <Layout>
      {/* Hero */}
      <div className="relative mb-8 sm:mb-10 rounded-2xl sm:rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-pink-900/20 to-[#0d0d1a]" />
        <div className="absolute top-0 left-1/4 w-48 sm:w-72 h-48 sm:h-72 bg-purple-600/20 blur-[60px] sm:blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-36 sm:w-56 h-36 sm:h-56 bg-pink-600/20 blur-[50px] sm:blur-[60px] rounded-full pointer-events-none" />
        <div className="relative z-10 p-6 sm:p-10 md:p-16 flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
          <div className="flex-1 text-center sm:text-right w-full">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs sm:text-sm font-medium mb-4">
              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> مجتمع الرسامين الإبداعيين
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white mb-3 sm:mb-4 leading-tight">
              رسامين{" "}<span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">دريم</span>
            </h1>
            <p className="text-white/60 text-sm sm:text-lg max-w-md mx-auto sm:mx-0">ارسم شخصية الستريمر المفضلة لديك وشارك إبداعك مع المجتمع</p>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <Link href="/draw">
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-base sm:text-xl px-6 sm:px-8 py-4 sm:py-5 rounded-xl sm:rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.45)] hover:shadow-[0_0_50px_rgba(168,85,247,0.65)] transition-all">
                <span className="text-2xl sm:text-3xl">🎨</span> ارسم الستريمر
              </motion.button>
            </Link>
          </div>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-purple-500" /></div>
      ) : artworks.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 sm:py-24">
          <div className="text-6xl sm:text-7xl mb-5 sm:mb-6">🎨</div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">لا توجد رسمات بعد</h2>
          <p className="text-white/40 text-sm sm:text-base mb-7 sm:mb-8">كن أول من يرسم شخصية الستريمر!</p>
          <Link href="/draw">
            <button className="bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold px-7 sm:px-8 py-3.5 sm:py-4 rounded-xl shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all text-sm sm:text-base">
              ابدأ الرسم الآن 🖌️
            </button>
          </Link>
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
          <AnimatePresence>
            {artworks.map((art, i) => (
              <motion.div key={art.id} transition={{ delay: i * 0.04 }}>
                <ArtCard art={art} onOpen={setSelected} onRate={setRatingTarget} isAdmin={isAdmin} onAction={isAdmin ? handleAction : undefined} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {selected && <ArtViewer art={selected} onClose={() => setSelected(null)} onRate={a => { setSelected(null); setRatingTarget(a); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {ratingTarget && <RatingModal art={ratingTarget} onClose={() => setRatingTarget(null)} />}
      </AnimatePresence>
    </Layout>
  );
}
