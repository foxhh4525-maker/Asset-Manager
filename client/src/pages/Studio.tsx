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

// ─── نفس المشغّل الذكي ────────────────────────────────────
function parseClipUrl(url: string) {
  if (!url) return { type: "unknown" as const, url };
  if (url.startsWith("/api/videos/")) {
    const match = url.match(/_(\d+)-(\d+)\.mp4$/);
    return {
      type: "local" as const, url,
      startTime: match ? parseInt(match[1]) : 0,
      endTime:   match ? parseInt(match[2]) : 0,
    };
  }
  if (/youtube\.com\/clip\//.test(url)) return { type: "clip" as const, url };
  try {
    const u = new URL(url);
    const videoId   = u.searchParams.get("v");
    const startTime = parseInt(u.searchParams.get("start") ?? "0") || 0;
    const endTime   = parseInt(u.searchParams.get("end")   ?? "0") || 0;
    if (videoId) return { type: "youtube" as const, url: `https://www.youtube.com/watch?v=${videoId}`, videoId, startTime, endTime };
  } catch {}
  return { type: "unknown" as const, url };
}

function SmartPlayer({ url, clipId }: { url: string; clipId: number }) {
  const info = parseClipUrl(url);

  if (info.type === "local") {
    const fragment = info.startTime || info.endTime
      ? `#t=${info.startTime},${info.endTime}` : "";
    return (
      <video
        key={`${clipId}-local`}
        src={`${info.url}${fragment}`}
        controls
        playsInline
        className="w-full h-full object-contain bg-black"
      />
    );
  }

  if (info.type === "youtube") {
    return (
      <ReactPlayer
        key={`${clipId}-yt`}
        url={info.url}
        width="100%"
        height="100%"
        controls
        playing={false}
        config={{
          youtube: {
            playerVars: {
              start:          info.startTime || 0,
              ...(info.endTime > 0 ? { end: info.endTime } : {}),
              rel: 0, modestbranding: 1,
            },
          },
        }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
      <p className="text-sm text-center px-4">جاري تحميل الفيديو على السيرفر...</p>
      <a
        href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
      >
        <ExternalLink className="w-4 h-4" /> افتح على YouTube
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
                    <SmartPlayer url={currentClip.url} clipId={currentClip.id} />
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
