import { useState } from "react";
import { useClips, useUpdateClipStatus } from "@/hooks/use-clips";
import { Layout } from "@/components/layout";
import ReactPlayer from "react-player";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function Studio() {
  const { data: clips = [], isLoading } = useClips({ status: "pending", sort: "new" });
  const updateStatus = useUpdateClipStatus();
  const [current, setCurrent] = useState(0);

  const currentClip = clips?.[current];

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!currentClip) return;
    await updateStatus.mutateAsync({ id: currentClip.id, status });
    setCurrent((c) => Math.min((clips?.length || 1) - 1, c + 1));
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">لوحة التحكم — مراجعة المقاطع</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-4">
            {currentClip ? (
              <div className="aspect-video rounded overflow-hidden bg-black">
                <ReactPlayer {...{ url: currentClip.url } as any} width="100%" height="100%" controls />
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
                {clips.map((c: any, i: number) => (
                  <motion.div
                    key={c.id}
                    onClick={() => setCurrent(i)}
                    className={`p-2 rounded cursor-pointer flex items-center gap-2 border ${i === current ? 'border-primary/40 bg-primary/5' : 'hover:bg-white/5'}`}>
                    <img src={c.thumbnailUrl} className="w-20 aspect-video object-cover rounded" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{c.submitter?.username}</div>
                    </div>
                  </motion.div>
                ))}

                {clips.length === 0 && (
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
