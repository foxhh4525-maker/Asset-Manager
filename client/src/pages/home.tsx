import { useState } from "react";
import { Layout } from "@/components/layout";
import { ClipCard } from "@/components/clip-card";
import { useClips } from "@/hooks/use-clips";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Clock, Trophy } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
// ✅ استيراد مباشر (ليس lazy) لتجنب انهيار الصفحة
import ReactPlayer from "react-player/youtube";

// ── مساعد: استخراج videoId + start + end من رابط YouTube ──
function parseYouTubeUrl(url: string): {
  videoId: string | null;
  startTime: number;
  endTime: number;
  cleanUrl: string;
} {
  try {
    const u = new URL(url);
    // watch?v=VIDEO_ID
    let videoId = u.searchParams.get("v");
    // youtu.be/VIDEO_ID
    if (!videoId && u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1, 12) || null;
    }
    const startTime = parseInt(u.searchParams.get("start") ?? "0") || 0;
    const endTime   = parseInt(u.searchParams.get("end")   ?? "0") || 0;
    const cleanUrl  = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : url;
    return { videoId, startTime, endTime, cleanUrl };
  } catch {
    return { videoId: null, startTime: 0, endTime: 0, cleanUrl: url };
  }
}

export default function Home() {
  const [sortBy, setSortBy] = useState<"new" | "top">("new");
  const [selectedClip, setSelectedClip] = useState<any>(null);

  const { data: clips, isLoading, error } = useClips({
    status: "approved",
    sort: sortBy,
  });

  // استخرج بيانات المشغل عند فتح الـ Dialog
  const playerInfo = selectedClip
    ? parseYouTubeUrl(selectedClip.url)
    : null;

  return (
    <Layout>
      {/* Hero Section */}
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

      {/* Feed Controls */}
      <div className="flex items-center justify-between mb-8">
        <Tabs
          value={sortBy}
          onValueChange={(v) => setSortBy(v as any)}
          className="w-[400px]"
        >
          <TabsList className="bg-card border border-border/50 p-1 h-12">
            <TabsTrigger
              value="new"
              className="h-10 data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Clock className="w-4 h-4 ml-2" /> الأحدث
            </TabsTrigger>
            <TabsTrigger
              value="top"
              className="h-10 data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Flame className="w-4 h-4 ml-2" /> الأعلى تقييماً
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-card h-80 rounded-xl animate-pulse border border-border/50"
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-destructive">
            فشل في تحميل المقاطع. يرجى المحاولة مرة أخرى.
          </p>
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
            />
          ))}
        </div>
      )}

      {/* Video Modal */}
      <Dialog open={!!selectedClip} onOpenChange={() => setSelectedClip(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-border/50">
          <div className="aspect-video w-full">
            {selectedClip && playerInfo && (
              <ReactPlayer
                key={selectedClip.id}
                url={playerInfo.cleanUrl}
                playing
                controls
                width="100%"
                height="100%"
                config={{
                  youtube: {
                    playerVars: {
                      // ✅ يجبر المشغل على البدء والانتهاء عند اللقطة المحددة
                      start:           playerInfo.startTime || 0,
                      ...(playerInfo.endTime > 0
                        ? { end: playerInfo.endTime }
                        : {}),
                      rel:             0,
                      modestbranding:  1,
                      autoplay:        1,
                    },
                  },
                }}
              />
            )}
          </div>
          {selectedClip && (
            <div className="p-6 bg-card">
              <h2 className="text-2xl font-bold font-display mb-2">
                {selectedClip.title}
              </h2>
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
