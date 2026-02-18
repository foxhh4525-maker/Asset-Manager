import { useState } from "react";
import ReactPlayer from "react-player";
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

// ─── مشغّل ذكي يدعم Kick + YouTube + Local ──────────────
function extractKickClipId(url: string): string | null {
  const patterns = [
    /kick\.com\/clip\/([A-Za-z0-9_-]+)/i,
    /kick\.com\/[^/]+\/clips?\/([A-Za-z0-9_-]+)/i,
    /kick\.com\/clips\/([A-Za-z0-9_-]+)/i,
  ];
  for (const p of patterns) {
    const m = url?.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function SmartPlayer({ url, clipId, clip }: { url: string; clipId: number; clip?: any }) {
  // ─── كليب Kick ─────────────────────────────────────────
  const isKick = clip?.platform === "kick" || /kick\.com/i.test(url || "");
  if (isKick) {
    const kClipId   = clip?.videoId || extractKickClipId(url) || "";
    const directUrl = url?.startsWith("http")
      ? url
      : (kClipId ? `https://kick.com/clips/${kClipId}` : "https://kick.com");

    return (
      <div className="relative w-full h-full bg-black flex flex-col items-center justify-center gap-4">
        {clip?.thumbnailUrl && (
          <img src={clip.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" />
        )}
        <div className="relative z-10 flex flex-col items-center gap-5 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#53FC1F]/10 border-2 border-[#53FC1F]/40 flex items-center justify-center shadow-[0_0_30px_rgba(83,252,31,0.3)]">
            <svg viewBox="0 0 32 32" className="w-9 h-9" fill="#53FC1F">
              <path d="M4 4h6v10l8-10h8L16 16l10 12h-8L10 18v10H4V4z"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-base mb-1">{clip?.title || "Kick Clip"}</p>
            <p className="text-white/50 text-sm">كليبات Kick تُفتح مباشرةً على المنصة</p>
          </div>
          <a href={directUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#53FC1F] hover:bg-[#45e018] text-black font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(83,252,31,0.5)]">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-black"><path d="M8 5v14l11-7z"/></svg>
            شاهد على Kick
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  // ─── فيديو محلي ────────────────────────────────────────
  if (url?.startsWith("/api/videos/")) {
    const match    = url.match(/_(\d+)-(\d+)\.mp4$/);
    const fragment = match ? `#t=${match[1]},${match[2]}` : "";
    return (
      <video key={`${clipId}-local`} src={`${url}${fragment}`}
        controls playsInline className="w-full h-full object-contain bg-black" />
    );
  }

  // ─── YouTube ────────────────────────────────────────────
  const st = clip?.startTime || 0;
  const en = clip?.endTime   || 0;
  if (/youtube\.com|youtu\.be/i.test(url || "")) {
    return (
      <ReactPlayer
        key={`${clipId}-yt`}
        url={url}
        width="100%"
        height="100%"
        controls
        playing={false}
        config={{
          youtube: {
            playerVars: {
              start: st || 0,
              ...(en > 0 ? { end: en } : {}),
              rel: 0, modestbranding: 1,
            },
          },
        }}
      />
    );
  }

  // ─── Unknown ───────────────────────────────────────────
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

export default function Studio() {
  const { data: user, isLoading: isAuthLoading } = useUser();
  const { data: clips = [], isLoading, error } = useClips({ status: "pending", sort: "new" });
  const updateStatus = useUpdateClipStatus();
  const [current, setCurrent] = useState(0);
  const currentClip = clips?.[current];

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!currentClip) return;
    try {
      await updateStatus.mutateAsync({ id: currentClip.id, status });
      setCurrent((c) => Math.min(Math.max(0, (clips?.length || 1) - 2), c));
    } catch (err) { console.error(err); }
  };

  if (isAuthLoading) return (
    <Layout><div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>
  );

  if (!user || user.role !== "admin") return (
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
        ) : clips.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground"><p className="text-lg">لا توجد مقاطع بانتظار المراجعة ✅</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-4">
              {currentClip ? (
                <>
                  <div className="aspect-video rounded overflow-hidden bg-black">
                    <SmartPlayer url={currentClip.url} clipId={currentClip.id} clip={currentClip} />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{currentClip.title}</h2>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{currentClip.tag}</Badge>
                        <span className="text-sm text-muted-foreground">من: {currentClip.submitterName || currentClip.submitter?.username || "مجهول"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={() => handleDecision("rejected")}>
                        <X className="w-4 h-4 ml-1" /> رفض
                      </Button>
                      <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleDecision("approved")}>
                        <Check className="w-4 h-4 ml-1" /> قبول
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">لا يوجد مقطع محدد</div>
              )}
            </div>

            <div className="bg-card border border-border/50 rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-right">قائمة الانتظار ({clips.length})</h3>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {clips.map((clip, index) => (
                    <motion.div
                      key={clip.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setCurrent(index)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        index === current ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="w-12 h-8 rounded bg-muted overflow-hidden flex-shrink-0">
                        {clip.thumbnailUrl && <img src={clip.thumbnailUrl} alt={clip.title} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-sm font-medium truncate">{clip.title}</p>
                        <p className="text-xs text-muted-foreground">{clip.submitterName || clip.submitter?.username || "مجهول"}</p>
                      </div>
                    </motion.div>
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
