import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useUser } from "@/hooks/use-auth";
import { Pencil, X, Loader2, Trash2, CheckCircle, XCircle, Clock, Star, Palette } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ─────────────────────────────────────────────────
interface Artwork {
  id: number;
  imageData: string;
  artistName: string;
  artistAvatar: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

// ─── Hooks ─────────────────────────────────────────────────
function useArtworks(status = "approved") {
  return useQuery<Artwork[]>({
    queryKey: ["/api/artworks", status],
    queryFn: () => fetch(`/api/artworks?status=${status}`).then(r => r.json()),
  });
}

function useArtworkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approved" | "rejected" | "delete" }) => {
      if (action === "delete") return fetch(`/api/artworks/${id}`, { method: "DELETE" });
      return fetch(`/api/artworks/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/artworks"] });
    },
  });
}

// ─── مكوّن بطاقة الرسمة ────────────────────────────────────
function ArtCard({ art, onOpen, isAdmin, onAction }: {
  art: Artwork;
  onOpen: (a: Artwork) => void;
  isAdmin: boolean;
  onAction?: (id: number, action: "approved" | "rejected" | "delete") => void;
}) {
  const timeAgo = (iso: string) => {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 60) return "للتو";
    if (d < 3600) return `${Math.floor(d/60)} دقيقة`;
    if (d < 86400) return `${Math.floor(d/3600)} ساعة`;
    return `${Math.floor(d/86400)} يوم`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -10 }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3 }}
      className="group relative bg-[#12121e] rounded-2xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all shadow-xl hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] cursor-pointer"
      onClick={() => onOpen(art)}
    >
      {/* الرسمة */}
      <div className="relative aspect-[3/2] overflow-hidden bg-[#0d0d1a]">
        <img
          src={art.imageData}
          alt={`رسمة ${art.artistName}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* تدرج سفلي */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#12121e] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* زر عرض */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-purple-600/90 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur-sm shadow-lg">
            عرض الرسمة
          </div>
        </div>

        {/* أزرار الأدمن */}
        {isAdmin && onAction && (
          <div
            className="absolute top-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}
          >
            {art.status === "pending" && (
              <>
                <button
                  onClick={() => onAction(art.id, "approved")}
                  className="w-8 h-8 bg-green-600/90 hover:bg-green-600 rounded-lg flex items-center justify-center text-white shadow-lg"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onAction(art.id, "rejected")}
                  className="w-8 h-8 bg-red-600/90 hover:bg-red-600 rounded-lg flex items-center justify-center text-white shadow-lg"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => onAction(art.id, "delete")}
              className="w-8 h-8 bg-red-900/90 hover:bg-red-900 rounded-lg flex items-center justify-center text-white shadow-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* معلومات الفنان */}
      <div className="p-3 flex items-center gap-2.5">
        {art.artistAvatar ? (
          <img
            src={art.artistAvatar}
            alt={art.artistName}
            className="w-9 h-9 rounded-full border-2 border-purple-500/30 flex-shrink-0 object-cover bg-[#0d0d1a]"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold border-2 border-purple-500/30"
            style={{ background: `hsl(${art.artistName.charCodeAt(0) * 37 % 360}, 60%, 45%)` }}
          >
            {art.artistName.slice(0, 1)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{art.artistName}</p>
          <p className="text-white/40 text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" /> {timeAgo(art.createdAt)}
          </p>
        </div>
        <Palette className="w-4 h-4 text-purple-500/50 flex-shrink-0" />
      </div>
    </motion.div>
  );
}

// ─── مشاهد الرسمة المكبّرة ──────────────────────────────────
function ArtViewer({ art, onClose }: { art: Artwork; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="max-w-4xl w-full"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="bg-[#12121e] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <img
            src={art.imageData}
            alt={`رسمة ${art.artistName}`}
            className="w-full object-contain max-h-[70vh]"
          />
          <div className="p-5 flex items-center gap-4">
            {art.artistAvatar ? (
              <img
                src={art.artistAvatar}
                alt={art.artistName}
                className="w-14 h-14 rounded-full border-2 border-purple-500/50 object-cover bg-[#0d0d1a]"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold border-2 border-purple-500/50"
                style={{ background: `hsl(${art.artistName.charCodeAt(0) * 37 % 360}, 60%, 45%)` }}
              >
                {art.artistName.slice(0, 1)}
              </div>
            )}
            <div>
              <p className="text-white font-bold text-xl">{art.artistName}</p>
              <p className="text-purple-400 text-sm flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5" /> فنان رسامين دريم
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── الصفحة الرئيسية ────────────────────────────────────────
export default function DreamArtists() {
  const { data: user }  = useUser();
  const isAdmin         = user?.role === "admin";
  const [tab, setTab]   = useState<"approved" | "pending">("approved");
  const [selected, setSelected] = useState<Artwork | null>(null);
  const action = useArtworkAction();

  const statusQuery = isAdmin ? tab : "approved";
  const { data: artworks = [], isLoading } = useArtworks(statusQuery);

  const handleAction = useCallback((id: number, act: "approved" | "rejected" | "delete") => {
    action.mutate({ id, action: act });
  }, [action]);

  return (
    <Layout>
      {/* Hero Banner */}
      <div className="relative mb-10 rounded-3xl overflow-hidden">
        {/* خلفية متحركة */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-pink-900/20 to-[#0d0d1a]" />
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-600/20 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-pink-600/20 blur-[60px] rounded-full pointer-events-none" />

        <div className="relative z-10 p-10 md:p-16 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 text-center md:text-right">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-5">
              <Star className="w-4 h-4" />
              مجتمع الرسامين الإبداعيين
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-4 leading-tight">
              رسامين{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                دريم
              </span>
            </h1>
            <p className="text-white/60 text-lg max-w-md">
              ارسم شخصية الستريمر المفضلة لديك وشارك إبداعك مع المجتمع
            </p>
          </div>

          <div className="flex-shrink-0">
            <Link href="/draw">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xl px-8 py-5 rounded-2xl shadow-[0_0_40px_rgba(168,85,247,0.5)] hover:shadow-[0_0_60px_rgba(168,85,247,0.7)] transition-all"
              >
                <span className="text-3xl">🎨</span>
                ارسم الستريمر
              </motion.button>
            </Link>
          </div>
        </div>
      </div>

      {/* تبويبات الأدمن */}
      {isAdmin && (
        <div className="flex gap-2 mb-6">
          {([
            { id: "approved", label: "✅ المقبولة" },
            { id: "pending",  label: `⏳ الانتظار` },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                tab === t.id
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                  : "bg-[#1a1a2e] text-white/60 hover:text-white border border-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* الشبكة */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
        </div>
      ) : artworks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24"
        >
          <div className="text-7xl mb-6">🎨</div>
          <h2 className="text-2xl font-bold text-white mb-3">
            {tab === "pending" ? "لا توجد رسمات في الانتظار" : "لا توجد رسمات بعد"}
          </h2>
          <p className="text-white/40 mb-8">
            {tab === "pending" ? "جميع الرسمات تمت مراجعتها" : "كن أول من يرسم شخصية الستريمر!"}
          </p>
          {tab !== "pending" && (
            <Link href="/draw">
              <button className="bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all">
                ابدأ الرسم الآن 🖌️
              </button>
            </Link>
          )}
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <AnimatePresence>
            {artworks.map((art, i) => (
              <motion.div key={art.id} transition={{ delay: i * 0.05 }}>
                <ArtCard
                  art={art}
                  onOpen={setSelected}
                  isAdmin={isAdmin}
                  onAction={isAdmin ? handleAction : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* عارض الرسمة */}
      <AnimatePresence>
        {selected && <ArtViewer art={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </Layout>
  );
}
