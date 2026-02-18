import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useIdentity, buildAvatarUrl } from "@/hooks/use-identity";
import { useUser } from "@/hooks/use-auth";
import { IdentityModal } from "@/components/identity-modal";
import {
  Pen, Eraser, RotateCcw, RotateCw, Trash2, Download,
  Send, Square, Circle, Slash,
  PaintBucket, Type, Loader2, CheckCircle2, X, Sparkles, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";

type Tool = "pen" | "brush" | "eraser" | "fill" | "line" | "rect" | "circle" | "text";

const PALETTE = [
  "#000000","#262626","#525252","#A3A3A3","#D4D4D4","#F0F0F0","#FFFFFF",
  "#EF4444","#F97316","#EAB308","#22C55E","#06B6D4","#3B82F6","#8B5CF6","#EC4899",
  "#FCA5A5","#FED7AA","#FEF08A","#BBF7D0","#A5F3FC","#BFDBFE","#DDD6FE","#FBCFE8",
  "#7F1D1D","#7C2D12","#713F12","#14532D","#164E63","#1E3A5F","#3B0764","#831843",
  "#FF0080","#FF4500","#FFD700","#00FF7F","#00BFFF","#9400D3","#FF69B4","#40E0D0",
];

const BRUSH_SIZES = [2, 4, 8, 14, 22, 34];

interface Point { x: number; y: number; }

function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement): Point {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  if ("touches" in e) {
    const t = (e as React.TouchEvent).changedTouches[0] || (e as React.TouchEvent).touches[0];
    return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
  }
  return {
    x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
    y: ((e as React.MouseEvent).clientY - rect.top)  * scaleY,
  };
}

// Flood Fill احترافي
function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, fillColor: string) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const img  = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const cx = Math.round(x), cy = Math.round(y);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return;

  const si = (cy * w + cx) * 4;
  const tr = data[si], tg = data[si+1], tb = data[si+2], ta = data[si+3];

  let fc = fillColor;
  if (fc.length === 4) fc = "#"+fc[1]+fc[1]+fc[2]+fc[2]+fc[3]+fc[3];
  const fr = parseInt(fc.slice(1,3),16), fg = parseInt(fc.slice(3,5),16), fb = parseInt(fc.slice(5,7),16);

  if (Math.abs(tr-fr)<=2 && Math.abs(tg-fg)<=2 && Math.abs(tb-fb)<=2 && ta===255) return;

  const TOL = 35;
  function match(i: number) {
    return Math.abs(data[i]-tr)<=TOL && Math.abs(data[i+1]-tg)<=TOL &&
           Math.abs(data[i+2]-tb)<=TOL && Math.abs(data[i+3]-ta)<=TOL;
  }

  const visited = new Uint8Array(w * h);
  const q: number[] = [cy * w + cx];
  visited[cy * w + cx] = 1;
  let head = 0;
  while (head < q.length) {
    const pos = q[head++];
    const px = pos % w, py = (pos - px) / w;
    const pi = pos * 4;
    data[pi]=fr; data[pi+1]=fg; data[pi+2]=fb; data[pi+3]=255;
    if (px>0   && !visited[pos-1] && match((pos-1)*4)) { visited[pos-1]=1; q.push(pos-1); }
    if (px<w-1 && !visited[pos+1] && match((pos+1)*4)) { visited[pos+1]=1; q.push(pos+1); }
    if (py>0   && !visited[pos-w] && match((pos-w)*4)) { visited[pos-w]=1; q.push(pos-w); }
    if (py<h-1 && !visited[pos+w] && match((pos+w)*4)) { visited[pos+w]=1; q.push(pos+w); }
  }
  ctx.putImageData(img, 0, 0);
}

export default function DrawPage() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [, setLocation] = useLocation();
  const { data: user } = useUser();
  const { identity }   = useIdentity();

  const [tool,       setTool]       = useState<Tool>("pen");
  const [color,      setColor]      = useState("#FFFFFF");
  const [brushSize,  setBrushSize]  = useState(4);
  const [opacity,    setOpacity]    = useState(100);
  const [histIdx,    setHistIdx]    = useState(0);
  const [histLen,    setHistLen]    = useState(1);
  const [textInput,  setTextInput]  = useState("");
  const [textPos,    setTextPos]    = useState<Point | null>(null);
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [colorInput, setColorInput] = useState("#FFFFFF");

  // Refs حرجة - تُستخدم داخل event handlers لتجنب stale closure
  const toolRef      = useRef<Tool>("pen");
  const colorRef     = useRef("#FFFFFF");
  const szRef        = useRef(4);
  const opRef        = useRef(100);
  const drawingRef   = useRef(false);
  const startRef     = useRef<Point | null>(null);
  const histRef      = useRef<ImageData[]>([]);
  const hidxRef      = useRef(0);

  // مزامنة refs
  useEffect(() => { toolRef.current  = tool;      }, [tool]);
  useEffect(() => { colorRef.current = color;     }, [color]);
  useEffect(() => { szRef.current    = brushSize; }, [brushSize]);
  useEffect(() => { opRef.current    = opacity;   }, [opacity]);

  // تهيئة الكانفاس
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    histRef.current = [snap];
    hidxRef.current = 0;
    setHistIdx(0); setHistLen(1);
  }, []);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const snap = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    const next = histRef.current.slice(0, hidxRef.current + 1);
    next.push(snap);
    if (next.length > 60) next.shift();
    histRef.current  = next;
    hidxRef.current  = next.length - 1;
    setHistIdx(next.length - 1);
    setHistLen(next.length);
  }, []);

  const undo = useCallback(() => {
    if (hidxRef.current <= 0) return;
    const idx = hidxRef.current - 1;
    canvasRef.current!.getContext("2d")!.putImageData(histRef.current[idx], 0, 0);
    hidxRef.current = idx;
    setHistIdx(idx);
    overlayRef.current!.getContext("2d")!.clearRect(0, 0, 900, 600);
  }, []);

  const redo = useCallback(() => {
    if (hidxRef.current >= histRef.current.length - 1) return;
    const idx = hidxRef.current + 1;
    canvasRef.current!.getContext("2d")!.putImageData(histRef.current[idx], 0, 0);
    hidxRef.current = idx;
    setHistIdx(idx);
    overlayRef.current!.getContext("2d")!.clearRect(0, 0, 900, 600);
  }, []);

  const clearCanvas = useCallback(() => {
    const ctx = canvasRef.current!.getContext("2d")!;
    overlayRef.current!.getContext("2d")!.clearRect(0, 0, 900, 600);
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, 900, 600);
    drawingRef.current = false;
    startRef.current   = null;
    pushHistory();
  }, [pushHistory]);

  // إعداد ctx للرسم
  function styleCtx(ctx: CanvasRenderingContext2D, isPreview = false) {
    const t  = toolRef.current;
    const c  = colorRef.current;
    const sz = szRef.current;
    const op = opRef.current;
    ctx.globalAlpha = op / 100;
    ctx.strokeStyle = (t === "eraser" && !isPreview) ? "#111111" : c;
    ctx.fillStyle   = c;
    ctx.lineWidth   = (t === "eraser" && !isPreview) ? sz * 2.5 : sz;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.shadowBlur  = (t === "brush" && !isPreview) ? sz * 1.2 : 0;
    ctx.shadowColor = (t === "brush" && !isPreview) ? c : "transparent";
  }

  // رسم شكل
  function renderShape(ctx: CanvasRenderingContext2D, t: Tool, from: Point, to: Point, isPreview = false) {
    styleCtx(ctx, isPreview);
    ctx.beginPath();
    if (t === "line") {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else if (t === "rect") {
      ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
    } else if (t === "circle") {
      const rx = Math.abs(to.x - from.x) / 2;
      const ry = Math.abs(to.y - from.y) / 2;
      ctx.ellipse(from.x + (to.x-from.x)/2, from.y + (to.y-from.y)/2, rx||1, ry||1, 0, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  const handleDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const pt     = getPos(e, canvas);
    const t      = toolRef.current;

    if (t === "fill") {
      floodFill(ctx, pt.x, pt.y, colorRef.current);
      pushHistory();
      return;
    }
    if (t === "text") { setTextPos(pt); return; }

    drawingRef.current = true;
    startRef.current   = { ...pt };

    if (t === "pen" || t === "brush" || t === "eraser") {
      styleCtx(ctx);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    }
  }, [pushHistory]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas  = canvasRef.current!;
    const overlay = overlayRef.current!;
    const ctx     = canvas.getContext("2d")!;
    const octx    = overlay.getContext("2d")!;
    const pt      = getPos(e, canvas);
    const t       = toolRef.current;
    const from    = startRef.current;

    if (t === "pen" || t === "brush" || t === "eraser") {
      styleCtx(ctx);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    } else if (from) {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      renderShape(octx, t, from, pt, true);
    }
  }, []);

  const handleUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas  = canvasRef.current!;
    const overlay = overlayRef.current!;
    const ctx     = canvas.getContext("2d")!;
    const octx    = overlay.getContext("2d")!;
    const t       = toolRef.current;
    const from    = startRef.current;

    if (t === "pen" || t === "brush" || t === "eraser") {
      ctx.closePath();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    } else if (from) {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      const pt = getPos(e, canvas);
      renderShape(ctx, t, from, pt, false);
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    drawingRef.current = false;
    startRef.current   = null;
    pushHistory();
  }, [pushHistory]);

  const commitText = useCallback(() => {
    if (!textPos || !textInput.trim()) { setTextPos(null); setTextInput(""); return; }
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle   = colorRef.current;
    ctx.globalAlpha = opRef.current / 100;
    ctx.font        = `bold ${szRef.current * 5}px 'Cairo', sans-serif`;
    ctx.fillText(textInput, textPos.x, textPos.y);
    ctx.globalAlpha = 1;
    setTextPos(null); setTextInput("");
    pushHistory();
  }, [textPos, textInput, pushHistory]);

  const download = () => {
    const a = document.createElement("a");
    a.download = "dream-art.png";
    a.href = canvasRef.current!.toDataURL("image/png");
    a.click();
  };

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
        const newArtwork = await res.json();
        setSubmitted(true);
        // ✅ أضف الرسمة للكاش مباشرةً بدون انتظار refetch
        // هذا يضمن ظهورها فوراً عند الانتقال لصفحة الرسامين
        queryClient.setQueryData(
          ["/api/artworks", "approved"],
          (old: any[] = []) => {
            // لا تضف إذا كانت status = pending (الأدمن يراجعها)
            return old;
          }
        );
        // ✅ invalidate لضمان جلب أحدث البيانات عند mount الصفحة
        queryClient.invalidateQueries({ queryKey: ["/api/artworks"] });
        setTimeout(() => setLocation("/dream-artists"), 2000);
      }
    } catch {}
    setSubmitting(false);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); }
      if (e.key === "Escape") { setTextPos(null); setTextInput(""); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);

  const TOOLS: { id: Tool; icon: any; label: string }[] = [
    { id: "pen",    icon: Pen,         label: "قلم" },
    { id: "brush",  icon: Sparkles,    label: "فرشاة ضوئية" },
    { id: "eraser", icon: Eraser,      label: "ممحاة" },
    { id: "fill",   icon: PaintBucket, label: "تعبئة" },
    { id: "line",   icon: Slash,       label: "خط مستقيم" },
    { id: "rect",   icon: Square,      label: "مستطيل" },
    { id: "circle", icon: Circle,      label: "دائرة" },
    { id: "text",   icon: Type,        label: "نص" },
  ];

  const getCursor = () => {
    if (tool === "eraser") return "cell";
    if (tool === "fill")   return "crosshair";
    if (tool === "text")   return "text";
    return "crosshair";
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-2 lg:px-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                🎨
              </div>
              ارسم الستريمر
            </h1>
            <p className="text-muted-foreground text-xs mt-1">استخدم الأدوات الاحترافية لرسم شخصية الستريمر</p>
          </div>
          <Link href="/dream-artists">
            <Button variant="outline" size="sm" className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10">
              معرض الرسامين ←
            </Button>
          </Link>
        </motion.div>

        <div className="flex gap-3 flex-col">

          {/* شريط الأدوات */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-3 shadow-xl">
            <div className="flex items-center justify-between gap-1 mb-3 flex-wrap">
              <div className="flex gap-1">
                <button onClick={undo} disabled={histIdx <= 0} title="تراجع (Ctrl+Z)"
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button onClick={redo} disabled={histIdx >= histLen - 1} title="إعادة (Ctrl+Y)"
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <RotateCw className="w-4 h-4" />
                </button>
                <button onClick={clearCanvas} title="مسح الكل"
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-1 flex-wrap justify-center">
                {TOOLS.map(t => (
                  <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group
                      ${tool === t.id
                        ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.6)]"
                        : "text-white/50 hover:text-white hover:bg-white/10"}`}>
                    <t.icon className="w-4 h-4" />
                    <span className="absolute top-full mt-1 bg-black/90 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-white/50 text-xs whitespace-nowrap">الحجم {brushSize}px</span>
              <input type="range" min={1} max={80} value={brushSize}
                onChange={e => setBrushSize(Number(e.target.value))}
                className="flex-1 accent-purple-500" />
              <span className="text-white/50 text-xs whitespace-nowrap">الشفافية {opacity}%</span>
              <input type="range" min={1} max={100} value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                className="flex-1 accent-pink-500" />
            </div>
          </motion.div>

          {/* الكانفاس */}
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(168,85,247,0.1)] bg-[#111]"
            style={{ touchAction: "none", aspectRatio: "3/2" }}>
            <canvas ref={canvasRef} width={900} height={600}
              className="w-full h-full block"
              style={{ cursor: getCursor(), touchAction: "none" }}
              onMouseDown={handleDown} onMouseMove={handleMove}
              onMouseUp={handleUp} onMouseLeave={handleUp}
              onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp}
            />
            <canvas ref={overlayRef} width={900} height={600}
              className="absolute inset-0 w-full h-full pointer-events-none" />

            {/* إدخال النص */}
            <AnimatePresence>
              {textPos && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="bg-[#1a1a2e] border border-purple-500/40 rounded-2xl p-6 shadow-2xl w-80">
                    <h3 className="text-white font-bold mb-3 text-center">✏️ أضف نصاً</h3>
                    <input autoFocus value={textInput} onChange={e => setTextInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") commitText();
                        if (e.key === "Escape") { setTextPos(null); setTextInput(""); }
                      }}
                      placeholder="اكتب هنا..." dir="rtl"
                      className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 text-center text-lg mb-4" />
                    <div className="flex gap-2">
                      <button onClick={commitText}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-xl font-bold transition-colors">
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

            {/* نجاح الإرسال */}
            <AnimatePresence>
              {submitted && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center">
                  <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }} className="text-center">
                    <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">تم إرسال رسمتك! 🎉</h2>
                    <p className="text-white/60">ستظهر في المعرض بعد موافقة الأدمن</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* لوحة الألوان */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-white/60 text-xs font-medium uppercase tracking-widest whitespace-nowrap">اللون الحالي</label>
              <div className="w-10 h-10 rounded-xl border-2 border-white/20 shadow-lg flex-shrink-0 cursor-pointer relative overflow-hidden"
                style={{ backgroundColor: color }}>
                <input type="color" value={color}
                  onChange={e => { setColor(e.target.value); setColorInput(e.target.value); }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
              <input value={colorInput}
                onChange={e => { setColorInput(e.target.value); if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setColor(e.target.value); }}
                className="w-28 bg-black/40 border border-white/20 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                maxLength={7} dir="ltr" />
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(30px, 1fr))" }}>
              {PALETTE.map(c => (
                <button key={c} onClick={() => { setColor(c); setColorInput(c); }}
                  className={`aspect-square rounded-md border-2 transition-all hover:scale-110 hover:z-10 relative
                    ${color === c ? "border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.6)] z-10" : "border-transparent hover:border-white/40"}`}
                  style={{ backgroundColor: c }} title={c} />
              ))}
            </div>
          </motion.div>

          {/* أحجام الفرشاة */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-3 shadow-xl">
            <div className="flex items-center gap-2">
              <label className="text-white/60 text-xs font-medium whitespace-nowrap">حجم الفرشاة — {brushSize}px</label>
              <div className="flex gap-1 flex-1 justify-around">
                {BRUSH_SIZES.map(s => (
                  <button key={s} onClick={() => setBrushSize(s)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all
                      ${brushSize === s ? "border-purple-500 bg-purple-500/20" : "border-white/10 hover:border-white/30"}`}>
                    <div className="rounded-full bg-white"
                      style={{ width: Math.min(s+2,24), height: Math.min(s+2,24) }} />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* هوية الرسام + الأزرار */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 flex-col sm:flex-row">
            {!user && (
              <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 shadow-xl flex-1">
                <label className="text-white/60 text-xs font-medium uppercase tracking-widest block mb-2">الرسام</label>
                {identity ? (
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIdentityOpen(true)}>
                    <img src={buildAvatarUrl(identity.avatarStyle, identity.avatarSeed)}
                      className="w-10 h-10 rounded-full border-2 border-purple-500/40" alt="avatar" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{identity.name}</p>
                      <p className="text-purple-400 text-xs flex items-center gap-1">
                        <Pencil className="w-2.5 h-2.5" /> تعديل
                      </p>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setIdentityOpen(true)}
                    className="w-full py-3 border-2 border-dashed border-purple-500/30 rounded-xl text-purple-400 text-sm hover:border-purple-500/60 hover:bg-purple-500/5 transition-all">
                    + أنشئ هويتك
                  </button>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2 flex-1">
              <button onClick={download}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/5 transition-all font-medium">
                <Download className="w-4 h-4" /> تحميل الرسمة
              </button>
              <button onClick={submit} disabled={submitting}
                className="flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-base shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all disabled:opacity-70">
                {submitting
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الإرسال...</>
                  : <><Send className="w-5 h-5" /> إرسال الرسمة 🎨</>}
              </button>
            </div>
          </motion.div>

          <div className="bg-[#1a1a2e]/60 border border-white/5 rounded-xl p-3 text-white/40 text-xs flex gap-4 flex-wrap">
            <span>💡 <strong className="text-white/60">Ctrl+Z</strong> للتراجع</span>
            <span>💡 <strong className="text-white/60">Ctrl+Y</strong> للإعادة</span>
            <span>💡 اضغط على مربع اللون لفتح محدد الألوان</span>
            <span>💡 الدلو يملأ فقط المنطقة المحاطة بالألوان</span>
          </div>
        </div>
      </div>
      <IdentityModal open={identityOpen} onClose={() => setIdentityOpen(false)} />
    </Layout>
  );
}
