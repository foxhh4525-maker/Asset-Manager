/**
 * videoDownloader.ts
 * يحمّل مقاطع YouTube ويخزّنها محلياً للعرض المباشر من المنصة
 * يستخدم @distube/ytdl-core وffmpeg (إن وجد) لقطع اللقطة بالضبط
 */

import { createWriteStream, existsSync, mkdirSync } from "fs";
import { unlink } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";

// مجلد تخزين الفيديوهات
export const VIDEOS_DIR = path.resolve(process.cwd(), "uploads", "videos");

// تأكد من وجود المجلد عند الاستيراد
if (!existsSync(VIDEOS_DIR)) {
  mkdirSync(VIDEOS_DIR, { recursive: true });
}

// ────────────────────────────────────────────────────────────
//  الاسم المحلي للملف
// ────────────────────────────────────────────────────────────
export function getLocalVideoPath(videoId: string, start: number, end: number): string {
  const suffix = start || end ? `_${start}-${end}` : "";
  return path.join(VIDEOS_DIR, `${videoId}${suffix}.mp4`);
}

export function getLocalVideoUrl(videoId: string, start: number, end: number): string {
  const suffix = start || end ? `_${start}-${end}` : "";
  return `/api/videos/${videoId}${suffix}.mp4`;
}

// ────────────────────────────────────────────────────────────
//  تحميل باستخدام ytdl-core
// ────────────────────────────────────────────────────────────
async function downloadWithYtdl(
  videoId: string,
  outputPath: string
): Promise<boolean> {
  try {
    // dynamic import لتجنب خطأ إن لم تكن المكتبة مثبتة
    const ytdl = (await import("@distube/ytdl-core")).default;

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    if (!ytdl.validateURL(videoUrl)) return false;

    const stream = ytdl(videoUrl, {
      quality: "highestvideo",
      filter: (format) =>
        format.container === "mp4" && !!format.hasVideo && !!format.hasAudio,
    });

    await pipeline(stream, createWriteStream(outputPath));
    return true;
  } catch (err: any) {
    console.error("[ytdl] Download failed:", err?.message || err);
    // احذف الملف المكسور إن وجد
    try { await unlink(outputPath); } catch {}
    return false;
  }
}

// ────────────────────────────────────────────────────────────
//  قطع اللقطة باستخدام ffmpeg (اختياري)
// ────────────────────────────────────────────────────────────
async function trimWithFfmpeg(
  inputPath: string,
  outputPath: string,
  start: number,
  end: number
): Promise<boolean> {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const duration = end - start;
    const cmd = `ffmpeg -y -ss ${start} -i "${inputPath}" -t ${duration} -c copy "${outputPath}" 2>&1`;

    await execAsync(cmd);
    return true;
  } catch (err: any) {
    console.warn("[ffmpeg] Trim failed (not critical):", err?.message);
    return false;
  }
}

// ────────────────────────────────────────────────────────────
//  الدالة الرئيسية: حمّل الفيديو مع القطع إن أمكن
// ────────────────────────────────────────────────────────────
export async function downloadAndStoreVideo(
  videoId: string,
  startTime: number,
  endTime: number
): Promise<{ localUrl: string | null; error?: string }> {
  const finalPath = getLocalVideoPath(videoId, startTime, endTime);
  const finalUrl  = getLocalVideoUrl(videoId, startTime, endTime);

  // إذا كان موجوداً مسبقاً → أعد الرابط مباشرة
  if (existsSync(finalPath)) {
    return { localUrl: finalUrl };
  }

  const tempPath = path.join(VIDEOS_DIR, `${videoId}_full_tmp.mp4`);

  console.log(`[downloader] Downloading video ${videoId}...`);
  const downloaded = await downloadWithYtdl(videoId, tempPath);

  if (!downloaded) {
    return { localUrl: null, error: "ytdl download failed" };
  }

  // حاول القطع بـ ffmpeg إذا كان هناك توقيت محدد
  if (startTime > 0 || endTime > 0) {
    const trimmed = await trimWithFfmpeg(tempPath, finalPath, startTime, endTime);

    if (trimmed) {
      // احذف الملف الكامل المؤقت
      try { await unlink(tempPath); } catch {}
      console.log(`[downloader] Trimmed clip saved: ${finalPath}`);
    } else {
      // ffmpeg غير موجود → استخدم الفيديو كامل مع #t fragment
      const { rename } = await import("fs/promises");
      await rename(tempPath, finalPath);
      console.log(`[downloader] Full video saved (no ffmpeg): ${finalPath}`);
    }
  } else {
    const { rename } = await import("fs/promises");
    await rename(tempPath, finalPath);
  }

  return { localUrl: finalUrl };
}
