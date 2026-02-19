import { useState, useEffect } from "react";
import { useClips, useUpdateClipStatus } from "@/hooks/use-clips";
import { useUser } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Check, X, AlertCircle, Loader2, ShieldAlert, ExternalLink,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ─── استخراج Kick ID ──────────────────────────────────────
function extractKickClipId(url: string): string | null {
  const patterns = [
    /kick\.com\/clip\/([A-Za-z0-9_-]+)/i,
    /kick\.com\/[^/]+\/clips?\/([A-Za-z0-9_-]+)/i,
    /kick\.com\/clips\/([A-Za-z0-9_-]+)/i,
  ];
  for (const p of patterns) { const m = url?.match(p); if (m?.[1]) return m[1]; }
  return null;
}

function buildEmbedUrl(videoId: string, start = 0, end = 0) {
  const p = new URLSearchParams({ autoplay: "1", rel: "0", modestbranding: "1", start: String(start) });
  if (end > 0) p.set("end", String(end));
  return `https://www.youtube-nocookie.com/embed/${videoId}?${p}`;
}

// ─── زر Fallback احترافي عند فشل التشغيل ──────────────────
function ExternalFallback({ clip, isKick }: { clip: any; isKick: boolean }) {
  const directUrl = clip?.url?.startsWith("http") ? clip.url
    : isKick ? "https://kick.com" : "https://youtube.com";
  const accentColor = isKick ? "#53FC1F" : "#ff0000";

  return (
    <div className="relative w-full h-full bg-[#050505] flex flex-col items-center justify-center gap-5 overflow-hidden">
      {clip?.thumbnailUrl && (
        <img src={clip.thumbnailUrl} alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25 blur-sm scale-105" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />

      <div className="relative z-10 flex flex-col items-center gap-4 p-6 text-center">
        {/* أيقونة المنصة */}
        <a
          href={directUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center gap-4"
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{ background: accentColor, boxShadow: `0 0 0 8px ${accentColor}25, 0 0 50px ${accentColor}60` }}
          >
            {isKick ? (
              <svg viewBox="0 0 32 32" className="w-11 h-11" fill="#000">
                <path d="M4 4h6v10l8-10h8L16 16l10 12h-8L10 18v10H4V4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-11 h-11 ml-1" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-white font-bold text-lg drop-shadow">
              شاهد على {isKick ? "Kick" : "YouTube"}
            </p>
            <p className="text-white/50 text-sm mt-0.5 flex items-center justify-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              يفتح في تبويب جديد
            </p>
          </div>
        </a>

        {/* سبب الفشل */}
        <p className="text-white/30 text-xs max-w-[220px] leading-relaxed">
          {isKick
            ? "Kick لا يسمح بتضمين الكليبات خارج منصته"
            : "هذا المقطع محمي من التضمين من قِبل YouTube"}
        </p>
      </div>
    </div>
  );
}

// ─── مشغّل YouTube — مكوّن مستقل لتجنب hooks-in-conditionals ──
function YouTubePlayer({ clip }: { clip: any }) {
  const url = clip?.url || "";
  const st  = clip?.startTime || 0;
  const en  = clip?.endTime   || 0;

  // 1) إذا كان videoId محفوظاً → iframe مباشر
  const storedId = clip?.videoId;

  const [state, setState] = useState<{
    type: "loading" | "iframe" | "external";
    embedUrl?: string;
  }>({ type: "loading" });

  useEffect(() => {
    if (storedId) {
      setState({ type: "iframe", embedUrl: buildEmbedUrl(storedId, st, en) });
      return;
    }

    // 2) نطلب من السيرفر رابطاً حديثاً
    let cancelled = false;
    fetch(`/api/clips/${clip.id}/fresh-player`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        if (cancelled) return;
        if (d.type === "iframe" && d.url) setState({ type: "iframe", embedUrl: d.url });
        else setState({ type: "external" });
      })
      .catch(() => {
        if (cancelled) return;
        // fallback: نستخرج videoId من رابط watch?v=
        const vid = url.match(/[?&]v=([\w-]{11})/)?.[1] || url.match(/youtu\.be\/([\w-]{11})/)?.[1];
        if (vid) setState({ type: "iframe", embedUrl: buildEmbedUrl(vid, st, en) });
        else setState({ type: "external" });
      });

    return () => { cancelled = true; };
  }, [clip.id, storedId, url, st, en]);

  if (state.type === "loading") return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (state.type === "iframe" && state.embedUrl) return (
    <iframe
      key={state.embedUrl}
      src={state.embedUrl}
      className="w-full h-full border-0 block"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      title={clip?.title || ""}
    />
  );

  return <ExternalFallback clip={clip} isKick={false} />;
}

// ─── مشغّل Kick — مكوّن مستقل ────────────────────────────────
function KickPlayer({ clip }: { clip: any }) {
  const url = clip?.url || "";
  const kickId = clip?.videoId || extractKickClipId(url) || "";

  const [state, setState] = useState<{ type: "loading" | "direct" | "external"; src?: string }>(
    { type: "loading" }
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clips/${clip.id}/fresh-player`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        if (cancelled) return;
        if (d.type === "direct" && d.url) setState({ type: "direct", src: d.url });
        else setState({ type: "external" });
      })
      .catch(() => {
        if (cancelled) return;
        // فيديو mp4 مباشر؟
        if (kickId && /\.(mp4|webm)/i.test(kickId)) setState({ type: "direct", src: kickId });
        else setState({ type: "external" });
      });
    return () => { cancelled = true; };
  }, [clip.id, kickId]);

  if (state.type === "loading") return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#53FC1F" }} />
    </div>
  );

  if (state.type === "direct" && state.src) return (
    <video key={state.src} src={state.src} className="w-full h-full block" controls autoPlay playsInline>
      <source src={state.src} type="video/mp4" />
    </video>
  );

  return <ExternalFallback clip={clip} isKick={true} />;
}

// ─── الموزّع الرئيسي ─────────────────────────────────────────
function SmartPlayer({ clip }: { clip: any }) {
  const url    = clip?.url || "";
  const isKick = clip?.platform === "kick" || /kick\.com/i.test(url);

  if (isKick) return <KickPlayer clip={clip} />;

  if (/youtube\.com|youtu\.be/i.test(url)) return <YouTubePlayer clip={clip} />;

  // Unknown → external
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <p className="text-sm text-center px-4">لا يمكن تشغيل هذا الكليب مباشرةً</p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm">
        <ExternalLink className="w-4 h-4" /> افتح الكليب
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export default function Studio() {
  const { data: user, isLoading: isAuthLoading } = useUser();
  const { data: clips = [], isLoading, error } = useClips({ status: "pending", sort: "new" });
  const updateStatus = useUpdateClipStatus();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: artworks = [] } = useQuery({
    queryKey: ["/api/artworks", "pending"],
    queryFn: () => fetch(`/api/artworks?status=pending`).then(r => r.ok ? r.json() : []),
  });

  const updateArtworkStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/artworks/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return await res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/artworks"] }); toast({ title: "تم تحديث حالة العمل" }); },
  });
  const [current, setCurrent] = useState(0);
  const currentClip = (clips as any[])?.[current];

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!currentClip) return;
    try {
      await updateStatus.mutateAsync({ id: currentClip.id, status });
      setCurrent(c => Math.max(0, Math.min(c, Math.max(0, (clips as any[]).length - 2))));
    } catch (err) { console.error(err); }
  };

  if (isAuthLoading) return (
    <Layout><div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>
  );

  if (!user || (user as any).role !== "admin") return (
    <Layout>
      <div className="max-w-md mx-auto mt-20 text-center">
        <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">غير مصرح لك</h2>
        <p className="text-muted-foreground">هذه الصفحة للمشرفين فقط</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-right">لوحة التحكم — مراجعة المقاطع</h1>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : error ? (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>حدث خطأ في تحميل المقاطع</AlertDescription></Alert>
        ) : (clips as any[]).length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">✅ لا توجد مقاطع بانتظار المراجعة</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── المشغّل الرئيسي ── */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-4">
              {currentClip ? (
                <>
                  <div className="aspect-video rounded-xl overflow-hidden bg-black">
                    <SmartPlayer clip={currentClip} />
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold truncate">{currentClip.title}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <Badge variant="outline">{currentClip.tag}</Badge>
                        {(currentClip as any).platform === "kick" && (
                          <Badge className="bg-[#53FC1F]/10 text-[#53FC1F] border-[#53FC1F]/30 border">Kick</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          من:{" "}
                          <span className="text-foreground font-medium">
                            {(currentClip as any).submitterName || (currentClip as any).submitter?.username || "مجهول"}
                          </span>
                        </span>
                        {((currentClip as any).startTime > 0 || (currentClip as any).endTime > 0) && (
                          <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {Math.floor(((currentClip as any).startTime || 0) / 60)}:{String(((currentClip as any).startTime || 0) % 60).padStart(2, "0")}
                            {(currentClip as any).endTime > 0 && ` → ${Math.floor((currentClip as any).endTime / 60)}:${String((currentClip as any).endTime % 60).padStart(2, "0")}`}
                          </span>
                        )}
                        <a href={(currentClip as any).url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors ml-auto">
                          <ExternalLink className="w-3 h-3" /> فتح خارجياً
                        </a>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="destructive" onClick={() => handleDecision("rejected")} disabled={updateStatus.isPending}>
                        <X className="w-4 h-4 ml-1" /> رفض
                      </Button>
                      <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleDecision("approved")} disabled={updateStatus.isPending}>
                        <Check className="w-4 h-4 ml-1" /> قبول
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">لا يوجد مقطع محدد</div>
              )}
            </div>

            {/* ── قائمة الانتظار (كليبات) ── */}
            <div className="bg-card border border-border/50 rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-right">قائمة الانتظار ({(clips as any[]).length})</h3>
              <ScrollArea className="h-[420px]">
                <div className="space-y-2">
                  {(clips as any[]).map((clip: any, index: number) => (
                    <motion.div
                      key={clip.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      onClick={() => setCurrent(index)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                        index === current
                          ? "bg-primary/10 border-primary/30"
                          : "hover:bg-muted/50 border-transparent"
                      }`}
                    >
                      <div className="w-14 h-9 rounded-md bg-muted overflow-hidden flex-shrink-0">
                        {clip.thumbnailUrl
                          ? <img src={clip.thumbnailUrl} alt={clip.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">🎬</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-sm font-medium truncate">{clip.title}</p>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          {clip.platform === "kick" && (
                            <span className="text-[9px] font-black" style={{ color: "#53FC1F" }}>KICK</span>
                          )}
                          <p className="text-xs text-muted-foreground truncate">
                            {clip.submitterName || clip.submitter?.username || "مجهول"}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* ── رسومات بانتظار المراجعة ── */}
            <div className="bg-card border border-border/50 rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-right">رسومات بانتظار المراجعة ({(artworks as any[]).length})</h3>
              <ScrollArea className="h-[420px]">
                <div className="space-y-3">
                  {(artworks as any[]).map((art: any) => (
                    <div key={art.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40">
                      <div className="w-16 h-12 bg-black rounded overflow-hidden">
                        <img src={art.imageData} alt={art.artistName} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{art.artistName}</p>
                            <p className="text-xs text-white/40">{new Date(art.createdAt).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => updateArtworkStatus.mutate({ id: art.id, status: 'approved' })} className="bg-green-600 text-white">قبول</Button>
                            <Button variant="destructive" onClick={() => updateArtworkStatus.mutate({ id: art.id, status: 'rejected' })}>رفض</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

          </div>
        )}
      </div>
    </Layout>
  );
}
