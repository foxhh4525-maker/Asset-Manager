import { useState, useEffect, useRef } from "react";
import { useClips, useUpdateClipStatus } from "@/hooks/use-clips";
import { useUser } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";

function YouTubePlayer({ url, clipId }: { url: string; clipId: number }) {
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setEmbedSrc(null);

    // روابط عادية: watch?v= أو youtu.be/
    const watchMatch = url.match(/[?&]v=([\w-]{11})/);
    const shortMatch = url.match(/youtu\.be\/([\w-]{11})/);
    if (watchMatch) {
      setEmbedSrc(`https://www.youtube.com/embed/${watchMatch[1]}?autoplay=0`);
      setLoading(false);
      return;
    }
    if (shortMatch) {
      setEmbedSrc(`https://www.youtube.com/embed/${shortMatch[1]}?autoplay=0`);
      setLoading(false);
      return;
    }

    // روابط Clip: نجيب videoId من السيرفر
    const clipMatch = url.match(/youtube\.com\/clip\/([\w-]+)/);
    if (clipMatch) {
      fetch(`/api/youtube/resolve-clip?url=${encodeURIComponent(url)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.videoId) {
            // نبني الرابط مع وقت البداية والنهاية الدقيق للكليب
            let src = `https://www.youtube.com/embed/${data.videoId}?autoplay=0`;
            if (data.startTime) src += `&start=${data.startTime}`;
            if (data.endTime)   src += `&end=${data.endTime}`;
            setEmbedSrc(src);
          } else {
            setError(true);
          }
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
      return;
    }

    setError(true);
    setLoading(false);
  }, [url, clipId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !embedSrc) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">تعذّر تحميل الفيديو</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          ▶ افتح على YouTube
        </a>
      </div>
    );
  }

  return (
    <iframe
      key={embedSrc}
      src={embedSrc}
      width="100%"
      height="100%"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      style={{ border: "none" }}
    />
  );
}

export default function Studio() {
  const { data: user, isLoading: isAuthLoading } = useUser();
  const [, navigate] = useLocation();

  const { data: clips = [], isLoading, error } = useClips({ status: "pending", sort: "new" });
  const updateStatus = useUpdateClipStatus();
  const [current, setCurrent] = useState(0);

  const currentClip = clips?.[current];

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!currentClip) return;
    try {
      await updateStatus.mutateAsync({ id: currentClip.id, status });
      setCurrent((c) => Math.min(Math.max(0, (clips?.length || 1) - 2), c));
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  if (isAuthLoading) {
    return (
      <Layout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-20 text-center">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">غير مصرح لك</h2>
          <p className="text-muted-foreground">هذه الصفحة للمشرفين فقط</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-right">لوحة التحكم — مراجعة المقاطع</h1>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>حدث خطأ في تحميل المقاطع</AlertDescription>
          </Alert>
        ) : clips.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">لا توجد مقاطع بانتظار المراجعة ✅</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* قسم الفيديو الرئيسي */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-4">
              {currentClip ? (
                <>
                  <div className="aspect-video rounded overflow-hidden bg-black">
                    <YouTubePlayer url={currentClip.url} clipId={currentClip.id} />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{currentClip.title}</h2>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{currentClip.tag}</Badge>
                        <span className="text-sm text-muted-foreground">
                          من: {currentClip.submitter?.username || "مستخدم مجهول"}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={() => handleDecision("rejected")}>
                        <X className="w-4 h-4 ml-1" /> رفض
                      </Button>
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleDecision("approved")}
                      >
                        <Check className="w-4 h-4 ml-1" /> قبول
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  لا يوجد مقطع محدد
                </div>
              )}
            </div>

            {/* قائمة الانتظار */}
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
                        index === current
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="w-12 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {clip.thumbnailUrl ? (
                          <img
                            src={clip.thumbnailUrl}
                            alt={clip.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">...</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-sm font-medium truncate">{clip.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {clip.submitter?.username || "مجهول"}
                        </p>
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
