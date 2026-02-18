/**
 * identity-modal.tsx
 * نافذة إنشاء/تعديل هوية الزائر
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Shuffle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  useIdentity,
  buildAvatarUrl,
  AVATAR_STYLES,
  type VisitorIdentity,
} from "@/hooks/use-identity";

// أسماء مقترحة عشوائية
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

export function IdentityModal({ open, onClose, onSave }: IdentityModalProps) {
  const { identity, setIdentity } = useIdentity();

  const [name, setName]           = useState(identity?.name ?? "");
  const [style, setStyle]         = useState(identity?.avatarStyle ?? "bottts");
  const [seed, setSeed]           = useState(identity?.avatarSeed ?? randomSeed());
  const [nameError, setNameError] = useState("");

  // إعادة تعبئة الحقول عند فتح المودال
  useEffect(() => {
    if (open) {
      setName(identity?.name ?? "");
      setStyle(identity?.avatarStyle ?? "bottts");
      setSeed(identity?.avatarSeed ?? randomSeed());
      setNameError("");
    }
  }, [open]);

  const avatarUrl = buildAvatarUrl(style, seed);

  const handleShuffle = () => setSeed(randomSeed());

  const handleSuggest = () => {
    const s = SUGGESTED[Math.floor(Math.random() * SUGGESTED.length)];
    setName(s);
  };

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
    const id: VisitorIdentity = { name: trimmed, avatarStyle: style, avatarSeed: seed };
    setIdentity(id);
    onSave?.(id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-card border-border/60 p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 to-secondary/10 p-6 pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            هويتك في المنصة
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            اختر اسمك وشخصيتك — ستظهر مع كل كليب ترسله
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar Preview + Shuffle */}
          <div className="flex flex-col items-center gap-3">
            <motion.div
              key={avatarUrl}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <div className="w-24 h-24 rounded-full border-4 border-primary/40 overflow-hidden bg-background shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                <img src={avatarUrl} alt="avatar" className="w-full h-full" />
              </div>
              <button
                onClick={handleShuffle}
                className="absolute -bottom-1 -left-1 bg-primary text-white rounded-full p-1.5 shadow-lg hover:bg-primary/90 transition-colors"
                title="شخصية عشوائية"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
            </motion.div>

            {/* نمط الأفاتار */}
            <div className="flex flex-wrap justify-center gap-2">
              {AVATAR_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    style === s.id
                      ? "border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                      : "border-border/50 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* اسم اللاعب */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              اسمك في المنصة
            </label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(""); }}
                placeholder="أدخل اسمك..."
                className="h-11 bg-background/60 border-border text-right flex-1"
                dir="rtl"
                maxLength={30}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-11 px-3 border-primary/30 text-primary hover:bg-primary/10"
                onClick={handleSuggest}
                title="اقتراح اسم"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
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
            <p className="text-xs text-muted-foreground">
              هذا الاسم سيظهر على كل الكليبات التي ترسلها ✨
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-11">
              <Check className="w-4 h-4 ml-2" />
              حفظ الهوية
            </Button>
            <Button variant="ghost" onClick={onClose} className="h-11 px-4">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
