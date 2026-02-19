/**
 * identity-modal.tsx — نافذة تخصيص الهوية
 * اسم + صورة مخصصة فقط (بدون أفاتار تلقائي)
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, X, Camera, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIdentity, type VisitorIdentity } from "@/hooks/use-identity";

// ألوان للحرف الأول
const AVATAR_COLORS = [
  "#7c3aed","#2563eb","#059669","#d97706",
  "#dc2626","#db2777","#0891b2","#ea580c",
];
function nameToColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h << 5) - h + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

interface IdentityModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (identity: VisitorIdentity) => void;
}

export function IdentityModal({ open, onClose, onSave }: IdentityModalProps) {
  const { identity, setIdentity } = useIdentity();

  const [name, setName]               = useState(identity?.name ?? "");
  const [nameError, setNameError]     = useState("");
  const [customAvatar, setCustomAvatar] = useState<string | null>(
    identity?.customAvatar ?? null
  );
  const [isDragging, setIsDragging]   = useState(false);
  const [imgError, setImgError]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // إعادة تعيين الحالة كل مرة تُفتح النافذة
  useEffect(() => {
    if (open) {
      setName(identity?.name ?? "");
      setNameError("");
      setCustomAvatar(identity?.customAvatar ?? null);
      setImgError(false);
    }
  }, [open, identity]);

  /* ───── معالجة الصورة ───── */
  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setNameError("الملف يجب أن يكون صورة (PNG, JPG, GIF...)");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setNameError("الصورة يجب أن تكون أقل من 3MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCustomAvatar(result);
      setImgError(false);
      setNameError("");
    };
    reader.onerror = () => setNameError("حدث خطأ أثناء قراءة الصورة");
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // إعادة تعيين الـ input حتى يسمح برفع نفس الملف مرة أخرى
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  /* ───── حفظ ───── */
  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError("الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    if (trimmed.length > 30) {
      setNameError("الاسم طويل جداً (30 حرف كحد أقصى)");
      return;
    }
    const id: VisitorIdentity = {
      name: trimmed,
      customAvatar: customAvatar ?? null,
    };
    setIdentity(id);
    onSave?.(id);
    onClose();
  };

  /* ───── عرض الأفاتار ───── */
  const showImage = !!customAvatar && !imgError;
  const trimmedName = name.trim();
  const initials = trimmedName ? trimmedName[0].toUpperCase() : "؟";
  const bgColor = trimmedName ? nameToColor(trimmedName) : "#7c3aed";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm bg-[#0e0e16] border border-white/10 p-0 overflow-hidden rounded-2xl">

        {/* Header */}
        <div
          className="relative overflow-hidden p-5 pb-4"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(6,182,212,0.08))" }}
        >
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.2), transparent)", transform: "translate(30%, -30%)" }}
          />
          <h2 className="text-lg font-bold flex items-center gap-2 relative z-10">
            <Sparkles className="w-5 h-5 text-primary" />
            هويتك في المنصة
          </h2>
          <p className="text-xs text-muted-foreground mt-1 relative z-10">
            خصّص اسمك وصورتك — ستظهر مع كل كليب ترسله للجميع
          </p>
        </div>

        <div className="p-5 space-y-5">

          {/* صورة الملف الشخصي */}
          <div className="flex flex-col items-center gap-4">

            {/* معاينة الأفاتار */}
            <div className="relative">
              <div
                className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary/30 flex items-center justify-center select-none"
                style={{ boxShadow: "0 0 24px rgba(168,85,247,0.3)", background: showImage ? "black" : bgColor }}
              >
                {showImage ? (
                  <img
                    src={customAvatar!}
                    alt="صورتك"
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="text-white text-3xl font-bold">{initials}</span>
                )}
              </div>

              {/* زر الكاميرا */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors border-2 border-[#0e0e16]"
                title="تغيير الصورة"
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* منطقة رفع الصورة */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all"
              style={{
                borderColor: isDragging ? "hsl(var(--primary))" : "rgba(255,255,255,0.12)",
                background:  isDragging ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.02)",
              }}
            >
              <Upload className="w-5 h-5 text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs font-medium text-foreground/70">اضغط أو اسحب صورتك هنا</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, GIF — أقل من 3MB</p>
              </div>
            </div>

            {/* زر إزالة الصورة */}
            {customAvatar && (
              <button
                type="button"
                onClick={() => { setCustomAvatar(null); setImgError(false); }}
                className="text-[11px] text-destructive hover:underline"
              >
                إزالة الصورة
              </button>
            )}
          </div>

          {/* input الاسم */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/80">اسمك في المنصة</label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              placeholder="أدخل اسمك هنا..."
              className="h-10 bg-white/5 border-white/10 text-right focus:border-primary/50"
              dir="rtl"
              maxLength={30}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
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

          {/* أزرار الحفظ والإلغاء */}
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

        {/* input الملف المخفي */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </DialogContent>
    </Dialog>
  );
}
