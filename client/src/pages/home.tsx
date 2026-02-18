import { useState } from "react";
import { Layout } from "@/components/layout";
import { ClipCard } from "@/components/clip-card";
import { useClips } from "@/hooks/use-clips";
import { useUser } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Clock, Trophy, ExternalLink } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// ─────────────────────────────────────────────────────────────
//  مساعد: استخراج videoId و timestamps من أي رابط YouTube
// ─────────────────────────────────────────────────────────────
function parseYouTubeUrl(url: string): {
  videoId: string | null;
  startTime: number;
  endTime: number;
  rawUrl: string;
} {
  if (!url) return { videoId: null, startTime: 0, endTime: 0, rawUrl: url };

  // /api/videos/ID_start-end.mp4 (رابط محلي قديم)
  if (url.startsWith("/api/videos/")) {
    const match = url.match(/\/([a-zA-Z0-9_-]{11})_?(\d+)?-?(\d+)?\.mp4$/);
    return {
      videoId:   match?.[1] ?? null,
      startTime: match?.[2] ? parseInt(match[2]) : 0,
      endTime:   match?.[3] ? parseInt(match[3]) : 0,
      rawUrl:    url,
    };
  }

  try {
    const u = new URL(url);
    // watch?v= الرابط العادي
    const v = u.searchParams.get("v");
    if (v) {
      return {
        videoId:   v,
        startTime: parseInt(u.searchParams.get("start") ?? "0") || 0,
        endTime:   parseInt(u.searchParams.get("end")   ?? "0") || 0,
        rawUrl:    url,
      };
    }
    // youtu.be/ID
    const short = url.match(/youtu\.be\/([\w-]{11})/);
    if (short) {
      return {
        videoId:   short[1],
        startTime: parseInt(u.searchParams.get("t") ?? "0") || 0,
        endTime:   0,
        rawUrl:    url,
      };
    }
  } catch {}

  return { videoId: null, startTime: 0, endTime: 0, rawUrl: url };
}

// ─────────────────────────────────────────────────────────────
//  مشغّل YouTube IFrame — موثوق 100%، يدعم timestamps
// ─────────────────────────────────────────────────────────────
function SmartPlayer({ clip }: { clip: any }) {
  const { videoId, startTime, endTime, rawUrl } = parseYouTubeUrl(clip.url);

  // ✅ لدينا videoId → نشغّل مباشرة عبر IFrame
  if (videoId) {
    const params = new URLSearchParams({
      autoplay:       "1",
      rel:            "0",
      modestbranding: "1",
      start:          String(startTime || 0),
      enablejsapi:    "1",
    });
    if (endTime > 0) params.set("end", String(endTime));

    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;

    return (
      <iframe
        key={clip.id}
        src={embedUrl}
        className="w-full h-full border-0"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        title={clip.title}
      />
    );
  }

  // ❌ لا يوجد videoId → زر مشاهدة على YouTube بدون spin وهمي
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 bg-black text-white px-6 text-center">
      <div className="space-y-2">
        <p className="text-base font-semibold text-gray-200">{clip.title}</p>
        <p className="text-sm text-gray-400">
          هذا الكليب متاح مباشرة على YouTube
        </p>
      </div>
      <a
        href={rawUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors shadow-lg"
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
                <span>Submitted by {selectedClip.submitterName || selectedClip.submitter?.username || "زائر"}</span>
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
