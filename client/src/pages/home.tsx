import { useState } from "react";
import { Layout } from "@/components/layout";
import { ClipCard } from "@/components/clip-card";
import { useClips } from "@/hooks/use-clips";
import { useUser } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Clock, Trophy, ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ReactPlayer from "react-player";

// ─────────────────────────────────────────────────────────────
//  مساعد: تحليل الرابط وتحديد نوعه
// ─────────────────────────────────────────────────────────────
function parseClipUrl(url: string) {
  if (!url) return { type: "unknown" as const, url };

  // رابط محلي مخزّن على السيرفر ✅
  if (url.startsWith("/api/videos/")) {
    // استخرج start/end من اسم الملف: videoId_start-end.mp4
    const match = url.match(/_(\d+)-(\d+)\.mp4$/);
    const startTime = match ? parseInt(match[1]) : 0;
    const endTime   = match ? parseInt(match[2]) : 0;
    return { type: "local" as const, url, startTime, endTime };
  }

  // رابط /clip/ مكسور ❌
  if (/youtube\.com\/clip\//.test(url)) {
    return { type: "clip" as const, url };
  }

  // رابط watch?v= عادي ✅
  try {
    const u = new URL(url);
    const videoId  = u.searchParams.get("v");
    const startTime = parseInt(u.searchParams.get("start") ?? "0") || 0;
    const endTime   = parseInt(u.searchParams.get("end")   ?? "0") || 0;
    if (videoId) {
      const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
      return { type: "youtube" as const, url: cleanUrl, videoId, startTime, endTime };
    }
  } catch {}

  return { type: "unknown" as const, url };
}

// ─────────────────────────────────────────────────────────────
//  مكوّن المشغّل الذكي
// ─────────────────────────────────────────────────────────────
function SmartPlayer({ clip }: { clip: any }) {
  const info = parseClipUrl(clip.url);

  // ── 1. فيديو محلي مخزّن على السيرفر ──────────────────────
  if (info.type === "local") {
    // #t=start,end يُخبر المتصفح ببداية ونهاية التشغيل
    const fragment =
      info.startTime || info.endTime
        ? `#t=${info.startTime},${info.endTime}`
        : "";
    return (
      <video
        key={clip.id}
        src={`${info.url}${fragment}`}
        controls
        autoPlay
        playsInline
        className="w-full h-full object-contain bg-black"
        onError={(e) => console.warn("Video error:", e)}
      >
        متصفحك لا يدعم تشغيل الفيديو.
      </video>
    );
  }

  // ── 2. رابط YouTube watch?v= ──────────────────────────────
  if (info.type === "youtube") {
    return (
      <ReactPlayer
        key={`${clip.id}-yt`}
        url={info.url}
        playing
        controls
        width="100%"
        height="100%"
        config={{
          youtube: {
            playerVars: {
              start:          info.startTime || 0,
              ...(info.endTime > 0 ? { end: info.endTime } : {}),
              rel:            0,
              modestbranding: 1,
              autoplay:       1,
            },
          },
        }}
      />
    );
  }

  // ── 3. رابط /clip/ مكسور أو غير معروف → fallback ─────────
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 bg-black text-white">
      <div className="text-center space-y-2 px-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
        <p className="text-sm text-gray-300 font-medium">
          جاري تحميل الفيديو على السيرفر...
        </p>
        <p className="text-xs text-gray-500">
          سيكون جاهزاً خلال دقيقة، يمكنك مشاهدته على YouTube الآن
        </p>
      </div>
      <a
        href={clip.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2"
      >
        <ExternalLink className="w-4 h-4" />
        شاهد على YouTube
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export default function Home() {
  const [sortBy, setSortBy] = useState<"new" | "top">("new");
  const [selectedClip, setSelectedClip] = useState<any>(null);
  const { data: user } = useUser();
  const isAdmin = user?.role === "admin";

  const { data: clips, isLoading, error } = useClips({
    status: "approved",
    sort: sortBy,
  });

  return (
    <Layout>
      {/* Hero */}
      <div className="relative mb-12 rounded-2xl overflow-hidden p-8 md:p-12 border border-border/50 bg-gradient-to-br from-purple-900/20 via-background to-background">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <Trophy className="w-4 h-4" />
            <span>مسابقة أفضل المقاطع الأسبوعية مستمرة!</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight mb-4 text-glow">
            اكتشف اللحظات <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              الألعاب الملحمية
            </span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            أفضل المقاطع من المجتمع، يتم تصنيفها من قبلك. أرسل مقاطعك، صوّت
            على الآخرين، وتسلق لوحة الترتيب.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-8">
        <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)} className="w-[400px]">
          <TabsList className="bg-card border border-border/50 p-1 h-12">
            <TabsTrigger value="new" className="h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Clock className="w-4 h-4 ml-2" /> الأحدث
            </TabsTrigger>
            <TabsTrigger value="top" className="h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              <Flame className="w-4 h-4 ml-2" /> الأعلى تقييماً
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card h-80 rounded-xl animate-pulse border border-border/50" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-destructive">فشل في تحميل المقاطع.</p>
        </div>
      ) : clips?.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>لا توجد مقاطع. كن الأول في إرسال واحد!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {clips?.map((clip: any) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onPlay={() => setSelectedClip(clip)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={!!selectedClip} onOpenChange={() => setSelectedClip(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-border/50">
          <div className="aspect-video w-full">
            {selectedClip && <SmartPlayer clip={selectedClip} />}
          </div>
          {selectedClip && (
            <div className="p-6 bg-card">
              <h2 className="text-2xl font-bold font-display mb-2">{selectedClip.title}</h2>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Submitted by {selectedClip.submitter?.username}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                <span>{selectedClip.tag}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
