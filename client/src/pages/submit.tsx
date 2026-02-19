import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Loader2, ArrowLeft, Youtube, CheckCircle2, Film, Clock, ArrowRight, Pencil, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCreateClip, useClipMetadata } from "@/hooks/use-clips";
import { useUser } from "@/hooks/use-auth";
import { useIdentity } from "@/hooks/use-identity";
import { IdentityModal } from "@/components/identity-modal";
import { Layout } from "@/components/layout";

function fmtSec(sec: number): string {
  if (!sec) return "0:00";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

const submitSchema = z.object({
  url: z.string().url().regex(
    /^(https?:\/\/)?(www\.)?(youtube\.com\/(clip\/|watch\?)|youtu\.be\/|kick\.com\/).+$/,
    "يجب أن يكون رابط YouTube Clip أو Kick صالحاً"
  ),
  tag: z.string().min(1, "يرجى اختيار تصنيف"),
});

export default function SubmitPage() {
  const [, setLocation]   = useLocation();
  const [metadata, setMetadata] = useState<any>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const createClip    = useCreateClip();
  const fetchMetadata = useClipMetadata();
  const { data: user } = useUser();
  const { identity, avatarUrl } = useIdentity();

  // يجب أن يكون عنده هوية أو حساب
  const hasIdentity = !!user || !!identity;

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
      } catch { setMetadata(null); }
    }
  };

  const onSubmit = async (data: any) => {
    if (!metadata) return;
    if (!hasIdentity) { setIdentityOpen(true); return; }

    const submitterAvatar = user?.avatarUrl || avatarUrl || null;
    await createClip.mutateAsync({
      url:           metadata.convertedUrl || data.url,
      tag:           data.tag,
      title:         metadata.title,
      thumbnailUrl:  metadata.thumbnailUrl,
      channelName:   metadata.channelName,
      duration:      metadata.duration,
      submitterName: user ? user.username : (identity?.name ?? "زائر"),
      submitterAvatar,
    } as any);
    setLocation("/");
  };

  const hasTimestamps = metadata && (metadata.startTime > 0 || metadata.endTime > 0);

  return (
    <Layout>
      <div className="max-w-xl mx-auto py-10">
        <Link href="/">
          <Button variant="ghost" className="mb-6 text-muted-foreground hover:text-foreground gap-2">
            <ArrowLeft className="w-4 h-4" /> العودة
          </Button>
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

          {/* Header */}
          <div className="text-center space-y-1.5 mb-6">
            <h1 className="text-3xl font-bold tracking-tight">إرسال كليب</h1>
            <p className="text-muted-foreground text-sm">شارك أفضل لحظاتك مع المجتمع</p>
          </div>

          {/* ─── خطوة 1: الهوية ─── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold">1</div>
              هويتك
            </div>

            {user ? (
              /* مسجّل دخول */
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-white/8 bg-white/2">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-10 h-10 rounded-full ring-2 ring-primary/30" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{user.username}</p>
                  <p className="text-xs text-primary flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> حساب موثّق
                  </p>
                </div>
              </div>
            ) : identity ? (
              /* زائر عنده هوية */
              <button
                onClick={() => setIdentityOpen(true)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-primary/25 bg-primary/5 hover:border-primary/50 hover:bg-primary/8 transition-all group text-right"
              >
                {avatarUrl && (
                  <img src={avatarUrl} alt={identity.name}
                    className="w-10 h-10 rounded-full ring-2 ring-primary/30 flex-shrink-0 object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{identity.name}</p>
                  <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> هويتك جاهزة
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> تعديل
                </div>
              </button>
            ) : (
              /* لا هوية — مطلوب */
              <motion.button
                onClick={() => setIdentityOpen(true)}
                whileTap={{ scale: 0.98 }}
                className="w-full flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🎮
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm">أنشئ هويتك أولاً</p>
                  <p className="text-xs text-muted-foreground mt-0.5">اختر اسمك وصورتك لإرسال الكليب</p>
                </div>
                <span className="text-xs font-semibold text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> إنشاء الهوية الآن
                </span>
              </motion.button>
            )}
          </div>

          {/* ─── خطوة 2 + 3: الكليب ─── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold">2</div>
              الكليب والتصنيف
            </div>

            <div className="bg-card/50 border border-border/50 rounded-xl p-5 space-y-4">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* URL */}
                <div className="space-y-1.5">
                  <Label htmlFor="url" className="text-xs text-muted-foreground">رابط الكليب (YouTube أو Kick)</Label>
                  <div className="relative">
                    <Input
                      id="url"
                      placeholder="https://youtube.com/clip/... أو https://kick.com/clip/..."
                      {...form.register("url", { onChange: () => { if (metadata) setMetadata(null); } })}
                      onBlur={handleUrlBlur}
                      className="pr-10 bg-background/50 border-border/60 focus:border-primary h-11"
                      dir="ltr"
                    />
                    <Youtube className="absolute right-3 top-3 w-5 h-5 text-muted-foreground" />
                  </div>
                  {form.formState.errors.url && (
                    <p className="text-destructive text-xs">{form.formState.errors.url.message as string}</p>
                  )}
                </div>

                {/* Loading */}
                {fetchMetadata.isPending && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> جاري جلب معلومات الكليب...
                  </div>
                )}

                {/* Metadata preview */}
                {metadata && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 p-3 bg-background/40 rounded-xl border border-border/50">
                    <div className="relative w-32 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-black">
                      {metadata.thumbnailUrl && (
                        <img src={metadata.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/80 px-1 rounded text-[9px] font-mono text-white">
                        {metadata.duration}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 py-0.5 space-y-1">
                      <p className="font-semibold text-sm line-clamp-2">{metadata.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Film className="w-3 h-3" /> {metadata.channelName}
                      </p>
                      {hasTimestamps && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                          <Clock className="w-3 h-3" />
                          <Badge variant="outline" className="text-[9px] px-1">{fmtSec(metadata.startTime)}</Badge>
                          <ArrowRight className="w-3 h-3" />
                          <Badge variant="outline" className="text-[9px] px-1">{fmtSec(metadata.endTime)}</Badge>
                        </div>
                      )}
                      <p className="text-green-400 text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> جاهز للإرسال
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Tag */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">تصنيف الكليب</Label>
                  <Select value={form.watch("tag")} onValueChange={(v) => form.setValue("tag", v, { shouldValidate: true })}>
                    <SelectTrigger className="bg-background/50 border-border/60 h-11">
                      <SelectValue placeholder="اختر تصنيفاً" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Funny">مضحك / فشل 😂</SelectItem>
                      <SelectItem value="Epic">لحظة ملحمية ⚡</SelectItem>
                      <SelectItem value="Glitch">خلل / باج 🐛</SelectItem>
                      <SelectItem value="Skill">مهارة عالية 🎯</SelectItem>
                      <SelectItem value="Horror">مشهد مرعب 👻</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.tag && (
                    <p className="text-destructive text-xs">{form.formState.errors.tag.message as string}</p>
                  )}
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full h-11 font-bold bg-primary hover:bg-primary/90 text-white"
                  disabled={createClip.isPending || !metadata}
                >
                  {createClip.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> جاري الإرسال...</>
                  ) : !hasIdentity ? (
                    "أنشئ هويتك أولاً 👆"
                  ) : !metadata ? (
                    "أدخل رابط الكليب أولاً"
                  ) : (
                    "إرسال الكليب 🎮"
                  )}
                </Button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>

      <IdentityModal
        open={identityOpen}
        onClose={() => setIdentityOpen(false)}
        onSave={() => {}}
      />
    </Layout>
  );
}
