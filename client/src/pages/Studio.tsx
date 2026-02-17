import { useState } from "react";
import { useClips, useUpdateClipStatus } from "@/hooks/use-clips";
import { Layout } from "@/components/layout";
import ReactPlayer from "react-player";
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Studio() {
  const { data: clips = [], isLoading, error } = useClips({ status: "pending", sort: "new" });
  const updateStatus = useUpdateClipStatus();
  const [current, setCurrent] = useState(0);

  const currentClip = clips?.[current];

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!currentClip) return;
    await updateStatus.mutateAsync({ id: currentClip.id, status });
    setCurrent((c) => Math.min(Math.max(0, (clips?.length || 1) - 2), c));
  };

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
          <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-4">
            {currentClip ? (
              <div className="aspect-video rounded overflow-hidden bg-black">
                <ReactPlayer {...{ url: currentClip.url } as any} width="100%" height="100%" controls playing={false} />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">لا يوجد مقطع حالياً</div>
            )}

            {currentClip && (
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{currentClip.title}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{currentClip.tag}</Badge>
                    <span className="text-sm text-muted-foreground">من: {currentClip.submitter?.username}</span>
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
            )}
          </div>

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
                        i === current ? 'border-primary/40 bg-primary/5' : 'hover:bg-white/5 border-border/30'
                      }`}
                    >
                      <img src={c.thumbnailUrl} alt={c.title} className="w-20 aspect-video object-cover rounded" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.title}</div>
                        <div className="text-xs text-muted-foreground">{c.submitter?.username}</div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">لا توجد مقاطع في الانتظار</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </Layout>
  );
}
