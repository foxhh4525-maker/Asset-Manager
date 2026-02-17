import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Loader2,
  ArrowLeft,
  Youtube,
  CheckCircle2,
  Film,
  Lock,
  Clock,
  ArrowRight,
} from "lucide-react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useCreateClip, useClipMetadata } from "@/hooks/use-clips";
import { useUser, useLogin } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";

function fmtSec(sec: number): string {
  if (!sec) return "0:00";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

const submitSchema = z.object({
  url: z
    .string()
    .url()
    .regex(
      /^(https?:\/\/)?(www\.)?(youtube\.com\/(clip\/|watch\?)|youtu\.be\/).+$/,
      "يجب أن يكون رابط YouTube Clip صالحاً"
    ),
  tag: z.string().min(1, "يرجى اختيار تصنيف"),
});

export default function SubmitPage() {
  const [, setLocation] = useLocation();
  const [metadata, setMetadata] = useState<any>(null);
  const createClip = useCreateClip();
  const fetchMetadata = useClipMetadata();
  const { data: user, isLoading: userLoading } = useUser();
  const { login } = useLogin();

  const form = useForm({
    resolver: zodResolver(submitSchema),
    defaultValues: { url: "", tag: "" },
  });

  const handleUrlBlur = async () => {
    const url = form.getValues("url");
    if (url && !metadata && !fetchMetadata.isPending) {
      try {
        const data = await fetchMetadata.mutateAsync(url);
        setMetadata(data);
      } catch {
        setMetadata(null);
      }
    }
  };

  const handleUrlChange = () => {
    if (metadata) setMetadata(null);
  };

  const onSubmit = async (data: any) => {
    if (!user) { login(); return; }
    if (!metadata) return;

    // ✅ نرسل الرابط المحوّل الذي أعاده السيرفر، لا رابط /clip/ الأصلي
    await createClip.mutateAsync({
      url:          metadata.convertedUrl || data.url,
      tag:          data.tag,
      title:        metadata.title,
      thumbnailUrl: metadata.thumbnailUrl,
      channelName:  metadata.channelName,
      duration:     metadata.duration,
    });

    setLocation("/");
  };

  const hasTimestamps = metadata && (metadata.startTime > 0 || metadata.endTime > 0);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Feed
          </Button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-display font-bold text-glow">إرسال كليب</h1>
            <p className="text-muted-foreground">
              شارك أفضل لحظاتك في الألعاب مع المجتمع.
            </p>
          </div>

          <Card className="glass-panel border-border/50">
            <CardContent className="p-8">
              {userLoading && (
                <div className="flex items-center justify-center py-8 text-muted-foreground animate-pulse">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" /> جاري التحقق من الحساب...
                </div>
              )}

              {!userLoading && !user && (
                <Alert variant="destructive" className="mb-6">
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    يجب تسجيل الدخول لإرسال كليب.
                    <Button
                      variant="secondary"
                      className="ml-2 p-0 h-auto text-destructive hover:text-destructive/90"
                      onClick={login}
                    >
                      سجّل الدخول الآن
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* حقل الرابط */}
                <div className="space-y-2">
                  <Label htmlFor="url">رابط YouTube Clip</Label>
                  <div className="relative">
                    <Input
                      id="url"
                      placeholder="https://youtube.com/clip/..."
                      {...form.register("url", { onChange: handleUrlChange })}
                      onBlur={handleUrlBlur}
                      className="pr-10 bg-background/50 border-border focus:border-primary transition-colors h-12"
                      dir="ltr"
                    />
                    <Youtube className="absolute right-3 top-3.5 w-5 h-5 text-muted-foreground" />
                  </div>
                  {form.formState.errors.url && (
                    <p className="text-destructive text-sm mt-1">
                      {form.formState.errors.url.message as string}
                    </p>
                  )}
                </div>

                {fetchMetadata.isPending && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground animate-pulse">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> جاري جلب معلومات الكليب...
                  </div>
                )}

                {metadata && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-background/40 rounded-lg p-4 border border-border space-y-3"
                  >
                    <div className="flex gap-4">
                      <div className="relative w-40 aspect-video rounded overflow-hidden flex-shrink-0 bg-black">
                        {metadata.thumbnailUrl && (
                          <img
                            src={metadata.thumbnailUrl}
                            alt="Thumbnail"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute bottom-1 right-1 bg-black/80 px-1 rounded text-[10px] font-mono">
                          {metadata.duration}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 py-1 space-y-1">
                        <h4 className="font-semibold truncate pl-4">{metadata.title}</h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Film className="w-3 h-3" /> {metadata.channelName}
                        </p>
                        <div className="flex items-center gap-2 pt-2 text-green-500 text-sm">
                          <CheckCircle2 className="w-4 h-4" /> جاهز للإرسال
                        </div>
                      </div>
                    </div>

                    {/* بطاقة التحويل */}
                    {metadata.convertedUrl &&
                      metadata.convertedUrl !== form.getValues("url") && (
                        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5 text-sm space-y-1.5">
                          <div className="flex items-center gap-2 text-primary font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            تم تحويل رابط /clip/ تلقائياً ✅
                          </div>

                          {hasTimestamps && (
                            <div className="flex items-center gap-3 text-muted-foreground text-xs font-mono">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              <span>
                                من{" "}
                                <Badge variant="outline" className="font-mono text-[10px] px-1">
                                  {fmtSec(metadata.startTime)}
                                </Badge>
                              </span>
                              <ArrowRight className="w-3 h-3" />
                              <span>
                                إلى{" "}
                                <Badge variant="outline" className="font-mono text-[10px] px-1">
                                  {fmtSec(metadata.endTime)}
                                </Badge>
                              </span>
                            </div>
                          )}

                          <p
                            className="text-[10px] text-muted-foreground break-all font-mono leading-relaxed"
                            dir="ltr"
                          >
                            {metadata.convertedUrl}
                          </p>
                        </div>
                      )}
                  </motion.div>
                )}

                {/* التصنيف */}
                <div className="space-y-2">
                  <Label htmlFor="tag">تصنيف الكليب</Label>
                  <Select
                    value={form.watch("tag")}
                    onValueChange={(val) =>
                      form.setValue("tag", val, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="bg-background/50 border-border h-12">
                      <SelectValue placeholder="اختر تصنيفاً" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Funny">مضحك / فشل</SelectItem>
                      <SelectItem value="Epic">لحظة ملحمية</SelectItem>
                      <SelectItem value="Glitch">خلل / باج</SelectItem>
                      <SelectItem value="Skill">مهارة عالية</SelectItem>
                      <SelectItem value="Horror">مشهد مرعب</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.tag && (
                    <p className="text-destructive text-sm mt-1">
                      {form.formState.errors.tag.message as string}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-bold bg-primary text-white mt-4"
                  disabled={createClip.isPending || !metadata || !user || userLoading}
                >
                  {createClip.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> جاري الإرسال...
                    </>
                  ) : !user ? (
                    <>
                      <Lock className="w-5 h-5 mr-2" /> سجّل الدخول للإرسال
                    </>
                  ) : (
                    "إرسال الكليب"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
