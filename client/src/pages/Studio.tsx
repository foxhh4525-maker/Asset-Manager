import { useState } from "react";
import { useClips, useUpdateClipStatus } from "@/hooks/use-clips";
import { useUser } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useLocation } from "wouter";
// ReactPlayer removed — using iframe for YouTube Clips support
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

  // ✅ التحقق من تحميل بيانات المستخدم أولاً
  if (isAuthLoading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">جاري التحقق من الصلاحيات...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ✅ حماية الصفحة — يُسمح فقط للأدمن
  if (!user || user.role !== "admin") {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-20 text-center">
          <div className="flex flex-col items-center gap-4">
            <ShieldAlert className="w-16 h-16 text-destructive opacity-80" />
            <h2 className="text-2xl font-bold">غير مصرح بالدخول</h2>
            <p className="text-muted-foreground">
              هذه الصفحة مخصصة للمشرفين فقط.
            </p>
            <Button onClick={() => navigate("/")}>العودة للرئيسية</Button>
          </div>
        </div>
      </Layout>
    );
  }

  // حالة التحميل
  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">جاري تحميل المقاطع...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              خطأ في جلب المقاطع: {error instanceof Error ? error.message : "حدث خطأ غير متوقع"}
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">لوحة التحكم — مراجعة المقاطع</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* قسم الفيديو الرئيسي */}
          <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-4">
            {currentClip ? (
              <>
                <div className="aspect-video rounded overflow-hidden bg-black">
                  {(() => {
                    const url = currentClip.url;
                    // YouTube Clip: youtube.com/clip/CLIP_ID
                    // YouTube منع تضمين الكليبات — نعرض زر مشاهدة بدلاً منه
                    const clipMatch = url.match(/youtube\.com\/clip\/([\w-]+)/);
                    if (clipMatch) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full gap-4 bg-black">
                          {currentClip.thumbnailUrl && (
                            <img src={currentClip.thumbnailUrl} alt={currentClip.title} className="max-h-40 rounded-lg object-cover opacity-80" />
                          )}
                          <p className="text-sm text-muted-foreground text-center px-4">YouTube لا يسمح بتضمين الكليبات مباشرة</p>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            ▶ شاهد على YouTube
                          </a>
                        </div>
                      );
                    }
                    // YouTube watch: youtube.com/watch?v=VIDEO_ID
                    const watchMatch = url.match(/[?&]v=([\w-]+)/);
                    if (watchMatch) {
                      return (
                        <iframe
                          key={currentClip.id}
                          src={`https://www.youtube.com/embed/${watchMatch[1]}`}
                          width="100%"
                          height="100%"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ border: "none" }}
                        />
                      );
                    }
                    // youtu.be/VIDEO_ID
                    const shortMatch = url.match(/youtu\.be\/([\w-]+)/);
                    if (shortMatch) {
                      return (
                        <iframe
                          key={currentClip.id}
                          src={`https://www.youtube.com/embed/${shortMatch[1]}`}
                          width="100%"
                          height="100%"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ border: "none" }}
                        />
                      );
                    }
                    // fallback: open in new tab
                    return (
                      <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-3">
                        <p className="text-sm">لا يمكن تشغيل الرابط مباشرة</p>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                          افتح في YouTube
                        </a>
                      </div>
                    );
                  })()}
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
                      <X className="w-4 h-4 ml-2" /> رفض
                    </Button>
                    <Button onClick={() => handleDecision("approved")}>
                      <Check className="w-4 h-4 ml-2" /> قبول
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                لا يوجد مقطع حالياً للمراجعة
              </div>
            )}
          </div>

          {/* القائمة الجانبية */}
          <div className="bg-card border border-border/50 rounded-xl p-2">
            <h3 className="px-3 py-2 font-semibold">قائمة الانتظار ({clips?.length || 0})</h3>
            <ScrollArea className="h-96">
              <div className="space-y-2 p-2">
                {clips && clips.length > 0 ? (
                  clips.map((c: any, i: number) => (
                    <motion.div
                      key={c.id}
                      onClick={() => setCurrent(i)}
                      className={`p-2 rounded cursor-pointer flex items-center gap-2 border transition-all ${
                        i === current
                          ? "border-primary/40 bg-primary/5"
                          : "hover:bg-white/5 border-border/30"
                      }`}
                    >
                      <div className="w-20 h-12 bg-black/20 rounded overflow-hidden flex-shrink-0">
                        {c.thumbnailUrl ? (
                          <img
                            src={c.thumbnailUrl}
                            alt={c.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs">
                            فيديو
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.submitter?.username || "مجهول"}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    لا توجد مقاطع في الانتظار
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </Layout>
  );
}
