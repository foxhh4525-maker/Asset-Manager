import { useState } from "react";
import { sfx } from "@/App";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Loader2, ArrowLeft, Youtube, CheckCircle2,
  Film, Clock, ArrowRight, Pencil, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const AVATAR_COLORS = [
  "#7c3aed","#2563eb","#059669","#d97706",
  "#dc2626","#db2777","#0891b2","#ea580c",
];
function nameToColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h << 5) - h + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const submitSchema = z.object({
  url: z.string().regex(
    /^https?:\/\/(www\.)?(youtube\.com\/(clip\/|watch\?)|youtu\.be\/|kick\.com\/).+$/i,
    "يجب أن يكون رابط YouTube Clip أو Kick صالحاً"
  ),
  tag: z.string().min(1, "يرجى اختيار تصنيف"),
});

export default function SubmitPage() {
  const [, setLocation]         = useLocation();
  const [metadata, setMetadata] = useState<any>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const createClip    = useCreateClip();
  const fetchMetadata = useClipMetadata();
  const { data: user } = useUser();
  const { identity, avatarUrl } = useIdentity();

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
      url:           data.url,  // ✅ الرابط الأصلي — السيرفر يحوّله تلقائياً
      tag:           data.tag,
      title:         metadata.title,
      thumbnailUrl:  metadata.thumbnailUrl,
      channelName:   metadata.channelName,
      duration:      metadata.duration,
      submitterName: user ? user.username : (identity?.name ?? "زائر"),
      submitterAvatar,
    } as any);
    // ✅ عرض شاشة النجاح بدل redirect مباشر
    sfx.submit();
    setSubmitted(true);
    setTimeout(() => setLocation("/"), 5000);
  };

  const hasTimestamps = metadata && (metadata.startTime > 0 || metadata.endTime > 0);

  /* ─── عرض هوية المستخدم ─── */
  const identityName   = user ? user.username : identity?.name ?? "";
  const identityAvatar = user?.avatarUrl || avatarUrl || null;
  const initial        = identityName[0]?.toUpperCase() ?? "؟";
  const bgColor        = identityName ? nameToColor(identityName) : "#7c3aed";

  // ─── Success Screen ───────────────────────────────────────
  if (submitted) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 16, stiffness: 200 }}
            className="relative max-w-md w-full"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 blur-3xl rounded-3xl opacity-30"
              style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }} />

            <div className="relative bg-[#0e0e1a] border border-white/8 rounded-3xl p-10 text-center shadow-[0_0_80px_rgba(168,85,247,0.15)]">

              {/* Animated checkmark */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.2 }}
                className="relative inline-flex mb-6"
              >
                {/* Rings */}
                {[1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border border-green-400/30"
                    initial={{ scale: 0.5, opacity: 1 }}
                    animate={{ scale: 2.5 + i * 0.8, opacity: 0 }}
                    transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity, ease: "easeOut" }}
                  />
                ))}
                <div className="relative w-24 h-24 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))", border: "2px solid rgba(34,197,94,0.4)" }}>
                  <CheckCircle2 className="w-12 h-12 text-green-400" />
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-2xl font-black text-white mb-2"
              >
                تم الإرسال بنجاح! 🎉
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="mb-6 space-y-3"
              >
                {/* Status banner */}
                <div className="flex items-center gap-2.5 justify-center px-5 py-3 rounded-2xl"
                  style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}>
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <p className="text-amber-300 font-bold text-sm">مشاركتك حاليًا في مجتمع الاقتراحات</p>
                </div>

                {/* Info */}
                <div className="bg-white/3 border border-white/5 rounded-xl px-5 py-4 text-right space-y-2">
                  <p className="text-white/60 text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                    كليبك قيد مراجعة الأدمن الآن
                  </p>
                  <p className="text-white/60 text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                    بعد الموافقة سيظهر في الصفحة الرئيسية
                  </p>
                  <p className="text-white/60 text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                    يمكن للمجتمع التصويت على كليبك ✨
                  </p>
                </div>
              </motion.div>

              {/* Clip title */}
              {metadata?.title && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="mb-6 px-4 py-2.5 bg-white/4 border border-white/8 rounded-xl text-center"
                >
                  <p className="text-white/40 text-xs mb-0.5">الكليب المُرسَل</p>
                  <p className="text-white font-semibold text-sm line-clamp-1">{metadata.title}</p>
                </motion.div>
              )}

              {/* Progress to redirect */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="space-y-2"
              >
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(to right, #7c3aed, #ec4899)" }}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 5, ease: "linear" }}
                  />
                </div>
                <p className="text-white/25 text-xs">سيتم التحويل للرئيسية خلال ثوانٍ...</p>
              </motion.div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setLocation("/")}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="mt-5 w-full py-3 rounded-xl font-bold text-sm text-white transition-all"
                style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
              >
                العودة للرئيسية الآن
              </motion.button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

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
                  <img src={user.avatarUrl} alt={user.username}
                    className="w-10 h-10 rounded-full ring-2 ring-primary/30 object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: nameToColor(user.username) }}
                  >
                    {user.username[0]?.toUpperCase()}
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
                {identityAvatar ? (
                  <img src={identityAvatar} alt={identity.name}
                    className="w-10 h-10 rounded-full ring-2 ring-primary/30 flex-shrink-0 object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: bgColor }}
                  >
                    {initial}
                  </div>
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
              /* لا هوية */
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

          {/* ─── خطوة 2: الكليب ─── */}
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
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 p-3 bg-background/40 rounded-xl border border-border/50"
                  >
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
                  <Select
                    value={form.watch("tag")}
                    onValueChange={(v) => form.setValue("tag", v, { shouldValidate: true })}
                  >
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
