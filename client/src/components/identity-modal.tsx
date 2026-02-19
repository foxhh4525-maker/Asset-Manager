/**
 * identity-modal.tsx — نافذة الهوية المحسّنة
 * - رفع صورة مخصصة أو اختيار أفاتار
 * - تصميم أجمل وأحدث
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Shuffle, Check, X, Camera, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  useIdentity,
  buildAvatarUrl,
  AVATAR_STYLES,
  type VisitorIdentity,
} from "@/hooks/use-identity";

const SUGGESTED = [
  "أبو الشوق", "لاعب النار", "المحترف", "صياد الكليبات",
  "عاشق الألعاب", "ملك الهيدشوت", "الأسطورة", "خبير الفلومة",
  "سنايبر العرب", "أبو الكريم", "النمر الأسود", "فارس الليل",
];

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

interface IdentityModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (identity: VisitorIdentity) => void;
}

type AvatarMode = "generated" | "custom";

export function IdentityModal({ open, onClose, onSave }: IdentityModalProps) {
  const { identity, setIdentity } = useIdentity();

  const [name, setName]             = useState(identity?.name ?? "");
  const [style, setStyle]           = useState(identity?.avatarStyle ?? "bottts");
  const [seed, setSeed]             = useState(identity?.avatarSeed ?? randomSeed());
  const [nameError, setNameError]   = useState("");
  const [avatarMode, setAvatarMode] = useState<AvatarMode>(
    identity?.customAvatar ? "custom" : "generated"
  );
  const [customAvatar, setCustomAvatar] = useState<string | null>(
    identity?.customAvatar ?? null
  );
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(identity?.name ?? "");
      setStyle(identity?.avatarStyle ?? "bottts");
      setSeed(identity?.avatarSeed ?? randomSeed());
      setNameError("");
      setAvatarMode(identity?.customAvatar ? "custom" : "generated");
      setCustomAvatar(identity?.customAvatar ?? null);
    }
  }, [open]);

  const generatedUrl = buildAvatarUrl(style, seed);
  const displayAvatar = avatarMode === "custom" && customAvatar ? customAvatar : generatedUrl;

  const handleShuffle = () => { setSeed(randomSeed()); setAvatarMode("generated"); };

  const handleSuggest = () => {
    setName(SUGGESTED[Math.floor(Math.random() * SUGGESTED.length)]);
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) { setNameError("الصورة يجب أن تكون أقل من 2MB"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCustomAvatar(result);
      setAvatarMode("custom");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) { setNameError("الاسم يجب أن يكون حرفين على الأقل"); return; }
    if (trimmed.length > 30) { setNameError("الاسم طويل جداً (30 حرف كحد أقصى)"); return; }
    const id: VisitorIdentity = {
      name: trimmed,
      avatarStyle: style,
      avatarSeed: seed,
      customAvatar: avatarMode === "custom" ? customAvatar : undefined,
    };
    setIdentity(id);
    onSave?.(id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm bg-[#0e0e16] border border-white/10 p-0 overflow-hidden rounded-2xl">

        {/* Header */}
        <div className="relative overflow-hidden p-5 pb-4"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(6,182,212,0.08))" }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.2), transparent)", transform: "translate(30%, -30%)" }} />
          <h2 className="text-lg font-bold flex items-center gap-2 relative z-10">
            <Sparkles className="w-5 h-5 text-primary" />
            هويتك في المنصة
          </h2>
          <p className="text-xs text-muted-foreground mt-1 relative z-10">
            خصص اسمك وصورتك — ستظهر مع كل كليب ترسله
          </p>
        </div>

        <div className="p-5 space-y-5">

          {/* Avatar Section */}
          <div className="flex gap-4 items-start">
            {/* Preview */}
            <div className="relative flex-shrink-0">
              <motion.div
                key={displayAvatar}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/30 bg-black/40"
                style={{ boxShadow: "0 0 20px rgba(168,85,247,0.25)" }}
              >
                <img src={displayAvatar} alt="avatar" className="w-full h-full object-cover" />
              </motion.div>

              {/* Camera overlay */}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
              />
            </div>

            {/* Mode Tabs + Controls */}
            <div className="flex-1 space-y-2.5">
              {/* Mode toggle */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
                {[
                  { id: "generated" as AvatarMode, label: "🎲 تلقائي" },
                  { id: "custom" as AvatarMode, label: "📷 صورة" },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => { setAvatarMode(id); if (id === "generated") setCustomAvatar(null); }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: avatarMode === id ? "hsl(var(--primary))" : "transparent",
                      color: avatarMode === id ? "white" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Generated mode — style picker + shuffle */}
              {avatarMode === "generated" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {AVATAR_STYLES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setStyle(s.id)}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium border transition-all"
                        style={{
                          borderColor: style === s.id ? "hsl(var(--primary))" : "rgba(255,255,255,0.08)",
                          background: style === s.id ? "rgba(168,85,247,0.15)" : "transparent",
                          color: style === s.id ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleShuffle}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                  >
                    <Shuffle className="w-3 h-3" /> شخصية عشوائية
                  </button>
                </div>
              )}

              {/* Custom mode — upload area */}
              {avatarMode === "custom" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-dashed cursor-pointer transition-all"
                  style={{
                    borderColor: isDragging ? "hsl(var(--primary))" : "rgba(255,255,255,0.12)",
                    background: isDragging ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground text-center">
                    اضغط أو اسحب صورة هنا<br />
                    <span className="opacity-60">PNG, JPG — أقل من 2MB</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Name Field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/80">اسمك في المنصة</label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(""); }}
                placeholder="أدخل اسمك..."
                className="h-10 bg-white/5 border-white/10 text-right flex-1 focus:border-primary/50"
                dir="rtl"
                maxLength={30}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <button
                type="button"
                onClick={handleSuggest}
                className="h-10 w-10 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors flex items-center justify-center flex-shrink-0"
                title="اقتراح اسم"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
            <AnimatePresence>
              {nameError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-destructive text-xs"
                >
                  {nameError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSave}
              className="flex-1 h-10 bg-primary hover:bg-primary/90 text-white font-bold text-sm"
            >
              <Check className="w-4 h-4 ml-1.5" />
              حفظ الهوية
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-10 w-10 p-0 border border-white/8 hover:border-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
