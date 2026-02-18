import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useIdentity, buildAvatarUrl } from "@/hooks/use-identity";
import { useUser } from "@/hooks/use-auth";
import { IdentityModal } from "@/components/identity-modal";
import {
  Pen, Eraser, RotateCcw, RotateCw, Trash2, Download,
  Send, ChevronDown, Minus, Square, Circle, Slash,
  PaintBucket, Type, Loader2, CheckCircle2, X, Sparkles, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── أنواع الأدوات ───────────────────────────────────────────
type Tool = "pen" | "brush" | "eraser" | "fill" | "line" | "rect" | "circle" | "text";

// ─── لوحة الألوان ──────────────────────────────────────────
const PALETTE = [
  "#FFFFFF","#F8F8F8","#D4D4D4","#A3A3A3","#525252","#262626","#0A0A0A",
  "#EF4444","#F97316","#EAB308","#22C55E","#06B6D4","#3B82F6","#8B5CF6","#EC4899",
  "#FCA5A5","#FED7AA","#FEF08A","#BBF7D0","#A5F3FC","#BFDBFE","#DDD6FE","#FBCFE8",
  "#7F1D1D","#7C2D12","#713F12","#14532D","#164E63","#1E3A5F","#3B0764","#831843",
];

// ─── أحجام الفرشاة ─────────────────────────────────────────
const BRUSH_SIZES = [2, 4, 8, 14, 22, 34];

interface Point { x: number; y: number; }

function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  if ("touches" in e) {
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top)  * scaleY,
    };
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
  };
}

// ─── Flood Fill ─────────────────────────────────────────────
function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, fillColor: string) {
  const img    = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data   = img.data;
  const cx = Math.floor(x); const cy = Math.floor(y);
  const idx = (cy * ctx.canvas.width + cx) * 4;
  const tr = data[idx], tg = data[idx+1], tb = data[idx+2], ta = data[idx+3];

  const r = parseInt(fillColor.slice(1,3), 16);
  const g = parseInt(fillColor.slice(3,5), 16);
  const b = parseInt(fillColor.slice(5,7), 16);

  if (tr===r && tg===g && tb===b) return;
  const stack = [[cx, cy]];
  while (stack.length) {
    const [px, py] = stack.pop()!;
    const i = (py * ctx.canvas.width + px) * 4;
    if (data[i]!==tr || data[i+1]!==tg || data[i+2]!==tb || data[i+3]!==ta) continue;
    data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
    if (px>0) stack.push([px-1,py]);
    if (px<ctx.canvas.width-1) stack.push([px+1,py]);
    if (py>0) stack.push([px,py-1]);
    if (py<ctx.canvas.height-1) stack.push([px,py+1]);
  }
  ctx.putImageData(img, 0, 0);
}

export default function DrawPage() {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const overlayRef    = useRef<HTMLCanvasElement>(null); // لرسم الأشكال المعاينة
  const [, setLocation] = useLocation();
  const { data: user }  = useUser();
  const { identity }    = useIdentity();

  const [tool,       setTool]       = useState<Tool>("pen");
  const [color,      setColor]      = useState("#FFFFFF");
  const [brushSize,  setBrushSize]  = useState(4);
  const [opacity,    setOpacity]    = useState(100);
  const [history,    setHistory]    = useState<ImageData[]>([]);
  const [histIdx,    setHistIdx]    = useState(-1);
  const [isDrawing,  setIsDrawing]  = useState(false);
  const [startPt,    setStartPt]    = useState<Point | null>(null);
  const [textInput,  setTextInput]  = useState("");
  const [textPos,    setTextPos]    = useState<Point | null>(null);
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [colorInput, setColorInput] = useState("#FFFFFF");

  // ─── تهيئة الكانفاس ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  }, []);

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const img    = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => {
      const next = prev.slice(0, histIdx + 1);
      next.push(img);
      if (next.length > 50) next.shift();
      setHistIdx(next.length - 1);
      return next;
    });
  }, [histIdx]);

  const undo = useCallback(() => {
    if (histIdx <= 0) return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const newIdx = histIdx - 1;
    ctx.putImageData(history[newIdx], 0, 0);
    setHistIdx(newIdx);
  }, [history, histIdx]);

  const redo = useCallback(() => {
    if (histIdx >= history.length - 1) return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const newIdx = histIdx + 1;
    ctx.putImageData(history[newIdx], 0, 0);
    setHistIdx(newIdx);
  }, [history, histIdx]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  }, [saveHistory]);

  // ─── رسم بالفرشاة / القلم ─────────────────────────────
  const setupCtx = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = tool === "eraser" ? "#111111" : color;
    ctx.fillStyle   = color;
    ctx.globalAlpha = opacity / 100;
    ctx.lineWidth   = tool === "eraser" ? brushSize * 2 : brushSize;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    if (tool === "brush") {
      ctx.shadowBlur  = brushSize * 0.8;
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur  = 0;
    }
  }, [tool, color, brushSize, opacity]);

  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const pt     = getPos(e, canvas);

    if (tool === "fill") {
      floodFill(ctx, pt.x, pt.y, color);
      saveHistory();
      return;
    }
    if (tool === "text") {
      setTextPos(pt);
      return;
    }

    setIsDrawing(true);
    setStartPt(pt);

    if (tool === "pen" || tool === "brush" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      setupCtx(ctx);
    }
  }, [tool, color, setupCtx, saveHistory]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas  = canvasRef.current!;
    const overlay = overlayRef.current!;
    const ctx     = canvas.getContext("2d")!;
    const octx    = overlay.getContext("2d")!;
    const pt      = getPos(e, canvas);

    if (tool === "pen" || tool === "brush" || tool === "eraser") {
      setupCtx(ctx);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    } else if (startPt) {
      // معاينة الأشكال على الـ overlay
      octx.clearRect(0, 0, overlay.width, overlay.height);
      octx.strokeStyle = color;
      octx.fillStyle   = color;
      octx.globalAlpha = opacity / 100;
      octx.lineWidth   = brushSize;
      octx.lineCap     = "round";
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;

      octx.beginPath();
      if (tool === "line") {
        octx.moveTo(startPt.x, startPt.y);
        octx.lineTo(pt.x, pt.y);
        octx.stroke();
      } else if (tool === "rect") {
        octx.strokeRect(startPt.x, startPt.y, dx, dy);
      } else if (tool === "circle") {
        const rx = Math.abs(dx) / 2;
        const ry = Math.abs(dy) / 2;
        octx.ellipse(startPt.x + dx/2, startPt.y + dy/2, rx, ry, 0, 0, Math.PI*2);
        octx.stroke();
      }
    }
  }, [isDrawing, tool, color, brushSize, opacity, startPt, setupCtx]);

  const onPointerUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas  = canvasRef.current!;
    const overlay = overlayRef.current!;
    const ctx     = canvas.getContext("2d")!;
    const octx    = overlay.getContext("2d")!;
    const pt      = getPos(e, canvas);

    if (tool === "pen" || tool === "brush" || tool === "eraser") {
      ctx.closePath();
    } else if (startPt) {
      // دمج الـ overlay في الكانفاس الرئيسي
      ctx.drawImage(overlay, 0, 0);
      octx.clearRect(0, 0, overlay.width, overlay.height);

      if (tool === "line") {
        setupCtx(ctx);
        ctx.beginPath();
        ctx.moveTo(startPt.x, startPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else if (tool === "rect") {
        setupCtx(ctx);
        const dx = pt.x - startPt.x;
        const dy = pt.y - startPt.y;
        ctx.strokeRect(startPt.x, startPt.y, dx, dy);
      } else if (tool === "circle") {
        setupCtx(ctx);
        const dx = pt.x - startPt.x;
        const dy = pt.y - startPt.y;
        ctx.beginPath();
        ctx.ellipse(startPt.x + dx/2, startPt.y + dy/2, Math.abs(dx)/2, Math.abs(dy)/2, 0, 0, Math.PI*2);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    setIsDrawing(false);
    setStartPt(null);
    saveHistory();
  }, [isDrawing, tool, startPt, setupCtx, saveHistory]);

  // ─── إضافة نص ───────────────────────────────────────────
  const commitText = useCallback(() => {
    if (!textPos || !textInput.trim()) { setTextPos(null); setTextInput(""); return; }
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    ctx.fillStyle   = color;
    ctx.globalAlpha = opacity / 100;
    ctx.font        = `bold ${brushSize * 5}px 'Cairo', sans-serif`;
    ctx.fillText(textInput, textPos.x, textPos.y);
    ctx.globalAlpha = 1;
    setTextPos(null);
    setTextInput("");
    saveHistory();
  }, [textPos, textInput, color, opacity, brushSize, saveHistory]);

  // ─── تحميل ───────────────────────────────────────────────
  const download = () => {
    const canvas = canvasRef.current!;
    const a = document.createElement("a");
    a.download = "dream-art.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  // ─── إرسال ───────────────────────────────────────────────
  const submit = async () => {
    if (!user && !identity) { setIdentityOpen(true); return; }

    const canvas = canvasRef.current!;
    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    const artistName   = user ? user.username : (identity?.name ?? "زائر");
    const artistAvatar = user
      ? (user.avatarUrl || null)
      : (identity ? buildAvatarUrl(identity.avatarStyle, identity.avatarSeed) : null);

    setSubmitting(true);
    try {
      const res = await fetch("/api/artworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, artistName, artistAvatar }),
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => setLocation("/dream-artists"), 2000);
      }
    } catch {}
    setSubmitting(false);
  };

  // ─── اختصارات لوحة المفاتيح ─────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); }
      if (e.key === "Escape") { setTextPos(null); setTextInput(""); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const TOOLS: { id: Tool; icon: any; label: string }[] = [
    { id: "pen",    icon: Pen,        label: "قلم" },
    { id: "brush",  icon: Sparkles,   label: "فرشاة ضوئية" },
    { id: "eraser", icon: Eraser,     label: "ممحاة" },
    { id: "fill",   icon: PaintBucket,label: "تعبئة" },
    { id: "line",   icon: Slash,      label: "خط" },
    { id: "rect",   icon: Square,     label: "مستطيل" },
    { id: "circle", icon: Circle,     label: "دائرة" },
    { id: "text",   icon: Type,       label: "نص" },
  ];

  const getCursor = () => {
    if (tool === "eraser") return "cell";
    if (tool === "fill") return "crosshair";
    if (tool === "text") return "text";
    return "crosshair";
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                🎨
              </div>
              ارسم الستريمر
            </h1>
            <p className="text-muted-foreground text-sm mt-1">استخدم الأدوات الاحترافية لرسم شخصية الستريمر</p>
          </div>
          <Link href="/dream-artists">
            <Button variant="outline" className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10">
              معرض الرسامين ←
            </Button>
          </Link>
        </motion.div>

        <div className="flex gap-4 flex-col lg:flex-row">

          {/* ─── شريط الأدوات الجانبي ─── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex lg:flex-col gap-2 bg-[#1a1a2e] border border-white/10 rounded-2xl p-3 shadow-xl flex-wrap lg:flex-nowrap lg:w-20"
          >
            {/* الأدوات */}
            {TOOLS.map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.label}
                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-xs font-medium relative group
                  ${tool === t.id
                    ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)]"
                    : "text-white/50 hover:text-white hover:bg-white/10"
                  }`}
              >
                <t.icon className="w-5 h-5" />
                <span className="hidden lg:block text-[9px] leading-none">{t.label}</span>
                {/* Tooltip */}
                <span className="absolute right-full mr-2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden lg:block">
                  {t.label}
                </span>
              </button>
            ))}

            <div className="h-px bg-white/10 w-full hidden lg:block" />

            {/* Undo / Redo */}
            <button onClick={undo} disabled={histIdx <= 0} title="تراجع (Ctrl+Z)"
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <RotateCcw className="w-5 h-5" />
            </button>
            <button onClick={redo} disabled={histIdx >= history.length - 1} title="إعادة (Ctrl+Y)"
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <RotateCw className="w-5 h-5" />
            </button>
            <button onClick={clearCanvas} title="مسح الكل"
              className="w-12 h-12 rounded-xl flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all">
              <Trash2 className="w-5 h-5" />
            </button>
          </motion.div>

          {/* ─── الكانفاس ─── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(168,85,247,0.1)] bg-[#111]"
            style={{ touchAction: "none" }}
          >
            <canvas
              ref={canvasRef}
              width={900}
              height={600}
              className="w-full h-full block"
              style={{ cursor: getCursor() }}
              onMouseDown={onPointerDown}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
              onTouchStart={onPointerDown}
              onTouchMove={onPointerMove}
              onTouchEnd={onPointerUp}
            />
            {/* Overlay للمعاينة */}
            <canvas
              ref={overlayRef}
              width={900}
              height={600}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* ─── إدخال النص ─── */}
            <AnimatePresence>
              {textPos && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
                >
                  <div className="bg-[#1a1a2e] border border-purple-500/40 rounded-2xl p-6 shadow-2xl w-80">
                    <h3 className="text-white font-bold mb-3 text-center">✏️ أضف نصاً</h3>
                    <input
                      autoFocus
                      value={textInput}
                      onChange={e => setTextInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitText(); if (e.key === "Escape") { setTextPos(null); setTextInput(""); } }}
                      placeholder="اكتب هنا..."
                      dir="rtl"
                      className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 text-center text-lg mb-4"
                    />
                    <div className="flex gap-2">
                      <button onClick={commitText} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-xl font-bold transition-colors">
                        إضافة
                      </button>
                      <button onClick={() => { setTextPos(null); setTextInput(""); }}
                        className="px-4 py-2 rounded-xl border border-white/20 text-white/60 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── نجاح الإرسال ─── */}
            <AnimatePresence>
              {submitted && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="text-center"
                  >
                    <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">تم إرسال رسمتك! 🎉</h2>
                    <p className="text-white/60">ستظهر في المعرض بعد موافقة الأدمن</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ─── لوحة التحكم اليمنى ─── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-4 w-full lg:w-64"
          >
            {/* اللون الحالي */}
            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 shadow-xl">
              <label className="text-white/60 text-xs font-medium uppercase tracking-widest block mb-3">اللون الحالي</label>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-14 h-14 rounded-xl border-2 border-white/20 shadow-lg flex-shrink-0 cursor-pointer relative overflow-hidden"
                  style={{ backgroundColor: color }}
                >
                  <input
                    type="color"
                    value={color}
                    onChange={e => { setColor(e.target.value); setColorInput(e.target.value); }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
                <input
                  value={colorInput}
                  onChange={e => { setColorInput(e.target.value); if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setColor(e.target.value); }}
                  className="flex-1 bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  maxLength={7}
                />
              </div>

              {/* لوحة الألوان */}
              <div className="grid grid-cols-7 gap-1">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); setColorInput(c); }}
                    className={`w-full aspect-square rounded-md border transition-transform hover:scale-110 ${color === c ? "border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* حجم الفرشاة */}
            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 shadow-xl">
              <label className="text-white/60 text-xs font-medium uppercase tracking-widest block mb-3">
                حجم الفرشاة — {brushSize}px
              </label>
              <div className="flex items-center gap-2 mb-3">
                {BRUSH_SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => setBrushSize(s)}
                    className={`flex-1 flex items-center justify-center rounded-lg transition-all border ${brushSize === s ? "border-purple-500 bg-purple-500/20" : "border-white/10 hover:border-white/30"}`}
                    style={{ height: 36 }}
                  >
                    <div
                      className="rounded-full bg-white"
                      style={{ width: Math.min(s, 22), height: Math.min(s, 22) }}
                    />
                  </button>
                ))}
              </div>
              <input
                type="range" min={1} max={80} value={brushSize}
                onChange={e => setBrushSize(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>

            {/* الشفافية */}
            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 shadow-xl">
              <label className="text-white/60 text-xs font-medium uppercase tracking-widest block mb-3">
                الشفافية — {opacity}%
              </label>
              <input
                type="range" min={1} max={100} value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-white/30 text-xs mt-1">
                <span>شفاف</span><span>معتم</span>
              </div>
            </div>

            {/* هوية الرسام */}
            {!user && (
              <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 shadow-xl">
                <label className="text-white/60 text-xs font-medium uppercase tracking-widest block mb-3">الرسام</label>
                {identity ? (
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIdentityOpen(true)}>
                    <img
                      src={buildAvatarUrl(identity.avatarStyle, identity.avatarSeed)}
                      className="w-10 h-10 rounded-full border-2 border-purple-500/40"
                      alt="avatar"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{identity.name}</p>
                      <p className="text-purple-400 text-xs flex items-center gap-1">
                        <Pencil className="w-2.5 h-2.5" /> تعديل
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIdentityOpen(true)}
                    className="w-full py-3 border-2 border-dashed border-purple-500/30 rounded-xl text-purple-400 text-sm hover:border-purple-500/60 hover:bg-purple-500/5 transition-all"
                  >
                    + أنشئ هويتك
                  </button>
                )}
              </div>
            )}

            {/* أزرار الإجراءات */}
            <div className="flex flex-col gap-2">
              <button
                onClick={download}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/5 transition-all font-medium"
              >
                <Download className="w-4 h-4" /> تحميل الرسمة
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-base shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all disabled:opacity-70"
              >
                {submitting
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الإرسال...</>
                  : <><Send className="w-5 h-5" /> إرسال الرسمة 🎨</>
                }
              </button>
            </div>

            {/* تعليمات */}
            <div className="bg-[#1a1a2e]/60 border border-white/5 rounded-xl p-3 text-white/40 text-xs space-y-1">
              <p>💡 <strong className="text-white/60">Ctrl+Z</strong> للتراجع</p>
              <p>💡 <strong className="text-white/60">Ctrl+Y</strong> للإعادة</p>
              <p>💡 اضغط على اللون لفتح محدد الألوان</p>
            </div>
          </motion.div>
        </div>
      </div>

      <IdentityModal open={identityOpen} onClose={() => setIdentityOpen(false)} />
    </Layout>
  );
}
