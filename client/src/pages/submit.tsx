import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Loader2, ArrowLeft, Youtube, CheckCircle2, Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateClip, useClipMetadata } from "@/hooks/use-clips";
import { Layout } from "@/components/layout";

const submitSchema = z.object({
  url: z.string().url().regex(/^(https?:\/\/)?(www\.)?(youtube\.com\/clip\/|youtu\.be\/clip\/).+$/, "يجب أن يكون رابط مقطع يوتيوب صحيح"),
  tag: z.string().min(1, "يرجى اختيار فئة"),
});

export default function SubmitPage() {
  const [, setLocation] = useLocation();
  const [metadata, setMetadata] = useState<any>(null);
  const createClip = useCreateClip();
  const fetchMetadata = useClipMetadata();
  
  const form = useForm({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      url: "",
      tag: "",
    },
  });

  const handleUrlBlur = async () => {
    const url = form.getValues("url");
    if (url && !metadata && !fetchMetadata.isPending) {
      try {
        const data = await fetchMetadata.mutateAsync(url);
        setMetadata(data);
      } catch (error) {
        // Error handled by hook
        setMetadata(null);
      }
    }
  };

  const onSubmit = async (data: any) => {
    if (!metadata) return;
    
    await createClip.mutateAsync({
      url: data.url,
      tag: data.tag,
      title: metadata.title,
      thumbnailUrl: metadata.thumbnailUrl,
      channelName: metadata.channelName,
      duration: metadata.duration,
    });
    
    setLocation("/");
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-8 pr-0 hover:pr-2 transition-all">
            <ArrowLeft className="w-4 h-4 ml-2" /> العودة إلى الرسوم
          </Button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-display font-bold text-glow">إرسال مقطع</h1>
            <p className="text-muted-foreground">شارك أفضل لحظاتك في الألعاب مع المجتمع.</p>
          </div>

          <Card className="glass-panel border-border/50">
            <CardContent className="p-8">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* URL Input */}
                <div className="space-y-2">
                  <Label htmlFor="url">رابط مقطع يوتيوب</Label>
                  <div className="relative">
                    <Input
                      id="url"
                      placeholder="https://youtube.com/clip/..."
                      {...form.register("url")}
                      onBlur={handleUrlBlur}
                      className="pr-10 bg-background/50 border-border focus:border-primary transition-colors h-12"
                      dir="ltr"
                    />
                    <Youtube className="absolute right-3 top-3.5 w-5 h-5 text-muted-foreground" />
                  </div>
                  {form.formState.errors.url && (
                    <p className="text-destructive text-sm mt-1">{form.formState.errors.url.message as string}</p>
                  )}
                </div>

                {/* Metadata Preview */}
                {fetchMetadata.isPending && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground animate-pulse">
                    <Loader2 className="w-5 h-5 ml-2 animate-spin" /> جاري جلب معلومات المقطع...
                  </div>
                )}

                {metadata && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-background/40 rounded-lg p-4 border border-border flex gap-4"
                  >
                    <div className="relative w-40 aspect-video rounded overflow-hidden flex-shrink-0 bg-black">
                      <img src={metadata.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                      <div className="absolute bottom-1 right-1 bg-black/80 px-1 rounded text-[10px] font-mono">
                        {metadata.duration}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 py-1 space-y-1">
                      <h4 className="font-semibold truncate pl-4">{metadata.title}</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Film className="w-3 h-3" /> {metadata.channelName}
                      </p>
                      <div className="flex items-center gap-2 pt-2 text-success text-sm">
                        <CheckCircle2 className="w-4 h-4" /> جاهز للإرسال
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Tag Selection */}
                <div className="space-y-2">
                  <Label htmlFor="tag">فئة المقطع</Label>
                  <Select 
                    onValueChange={(val) => form.setValue("tag", val)}
                    defaultValue={form.getValues("tag")}
                  >
                    <SelectTrigger className="bg-background/50 h-12">
                      <SelectValue placeholder="اختر فئة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Funny">مضحك / فشل</SelectItem>
                      <SelectItem value="Epic">لحظة ملحمية</SelectItem>
                      <SelectItem value="Glitch">خلل / باج</SelectItem>
                      <SelectItem value="Skill">مهارة عالية</SelectItem>
                      <SelectItem value="Horror">مفاجأة مرعبة</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.tag && (
                    <p className="text-destructive text-sm mt-1">{form.formState.errors.tag.message as string}</p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg font-bold neon-button bg-primary hover:bg-primary/90 text-white mt-4"
                  disabled={createClip.isPending || !metadata}
                >
                  {createClip.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 ml-2 animate-spin" /> جاري الإرسال...
                    </>
                  ) : "إرسال المقطع"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
