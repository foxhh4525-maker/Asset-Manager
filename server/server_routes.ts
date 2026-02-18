import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import express from "express";
import path from "path";
import { storage as st } from "./storage";

// ─────────────────────────────────────────────────────────────
// كلمة مرور الأدمن — غيّرها في Replit Secrets: ADMIN_PASSWORD
// ─────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

let GUEST_USER_ID: number | null = null;

async function ensureSystemUsers() {
  // ── تأكد من وجود عمود submitter_name في جدول clips ──────
  if (pool) {
    try {
      const c = await pool.connect();
      await c.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS submitter_name text;`);
      await c.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS video_id text;`);
      await c.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS start_time integer DEFAULT 0;`);
      await c.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS end_time integer DEFAULT 0;`);
      await c.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS platform text DEFAULT 'youtube';`);
      await c.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS submitter_avatar text;`);
      await c.query(`
        CREATE TABLE IF NOT EXISTS artworks (
          id            serial PRIMARY KEY,
          image_data    text NOT NULL,
          artist_name   text NOT NULL DEFAULT 'زائر',
          artist_avatar text,
          status        text NOT NULL DEFAULT 'pending',
          created_at    timestamp NOT NULL DEFAULT now()
        );
      `);
      c.release();
    } catch (e: any) {
      console.warn("[migration] submitter_name column:", e?.message);
    }
  }
  let guest = await storage.getUserByDiscordId("system-guest").catch(() => null);
  if (!guest) {
    guest = await storage.createUser({
      discordId: "system-guest",
      username: "زائر",
      avatarUrl: "",
      role: "viewer",
    } as any);
  }
  GUEST_USER_ID = guest.id;

  let admin = await storage.getUserByDiscordId("local-admin").catch(() => null);
  if (!admin) {
    admin = await storage.createUser({
      discordId: "local-admin",
      username: "Admin",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=admin",
      role: "admin",
    } as any);
  } else if (admin.role !== "admin" && pool) {
    const c = await pool.connect();
    await c.query(`UPDATE users SET role = 'admin' WHERE discord_id = 'local-admin'`);
    c.release();
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const isProd = process.env.NODE_ENV === "production";
  const publicUrl = process.env.PUBLIC_URL || "";
  const cookieSecure = isProd || publicUrl.startsWith("https://");
  const cookieSameSite: any = cookieSecure ? "none" : "lax";

  let store: any;
  if (pool) {
    try {
      const PgSession = connectPgSimple(session as any);
      const client = await pool.connect();
      try {
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session') THEN
              CREATE TABLE "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
              ) WITH (OIDS=FALSE);
              ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
              CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
            END IF;
          END $$;
        `);
      } finally {
        client.release();
      }
      store = new PgSession({ pool, tableName: "session", createTableIfMissing: true });
      store.on && store.on("error", (err: any) => console.error("Session store error:", err));
    } catch (e: any) {
      console.warn("PgSession failed, using MemoryStore:", e?.message);
      store = new ((session as any).MemoryStore)();
    }
  } else {
    store = new ((session as any).MemoryStore)();
  }

  app.use(session({
    store,
    name: process.env.SESSION_COOKIE_NAME || "connect.sid",
    secret: process.env.SESSION_SECRET || "super_secret_key_change_me",
    resave: false,
    saveUninitialized: false,
    proxy: isProd,
    cookie: { httpOnly: true, secure: cookieSecure, sameSite: cookieSameSite, maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use("admin-local", new LocalStrategy(
    { usernameField: "username", passwordField: "password" },
    async (_username, password, done) => {
      if (password !== ADMIN_PASSWORD)
        return done(null, false, { message: "كلمة المرور غير صحيحة" });
      const admin = await storage.getUserByDiscordId("local-admin").catch(() => null);
      if (!admin) return done(null, false, { message: "خطأ في إعداد الأدمن" });
      return done(null, admin);
    }
  ));

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  await ensureSystemUsers();

  // ─── Auth ──────────────────────────────────────────────────

  app.post("/api/auth/admin-login", (req, res, next) => {
    passport.authenticate("admin-local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "كلمة المرور غير صحيحة" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          return res.json({ success: true, redirectTo: "/studio" });
        });
      });
    })(req, res, next);
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.sendStatus(200);
    });
  });

  // ─── Clips ─────────────────────────────────────────────────

  app.get(api.clips.list.path, async (req, res) => {
    const { status, sort } = req.query as { status?: string; sort?: string };
    const clips = await storage.getClips({ status, sort });
    res.json(clips);
  });

  // ✅ مفتوح للجميع — الزوار يرسلون باسمهم فقط
  app.post(api.clips.create.path, async (req, res) => {
    try {
      const input = api.clips.create.input.parse(req.body);
      const submitterName: string = (req.body.submitterName ?? "").trim() || "زائر";

      const metadata = isKickUrl(input.url)
        ? await fetchKickMetadata(input.url)
        : await fetchYouTubeMetadata(input.url);

      const submittedBy = req.isAuthenticated()
        ? (req.user as any).id
        : (GUEST_USER_ID ?? 1);

      const clip = await storage.createClip({
        url:           metadata.convertedUrl,
        title:         metadata.title,
        thumbnailUrl:  metadata.thumbnailUrl,
        channelName:   metadata.channelName,
        duration:      metadata.duration,
        tag:           input.tag,
        submittedBy,
        submitterName: req.isAuthenticated() ? (req.user as any).username : submitterName,
        // ✅ حفظ بيانات التشغيل مباشرةً — صفر parsing عند العرض
        platform:      metadata.platform   || "youtube",
        videoId:       metadata.videoId    || null,
        startTime:     metadata.startTime  || 0,
        endTime:       metadata.endTime    || 0,
        submitterAvatar: (req.body as any).submitterAvatar || null,
        upvotes:       0,
        downvotes:     0,
        status:        "pending",
      } as any);

      res.status(201).json(clip);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  app.patch(api.clips.updateStatus.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    if ((req.user as any).role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const clipId = parseInt(req.params.id);
    const updated = await storage.updateClipStatus(clipId, req.body.status);
    if (!updated) return res.status(404).json({ message: "Clip not found" });
    res.json(updated);
  });

  app.delete("/api/clips/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any)?.role !== "admin")
      return res.status(403).json({ message: "Forbidden" });
    const clipId = parseInt(req.params.id);
    if (isNaN(clipId)) return res.status(400).json({ message: "Invalid ID" });
    const deleted = await storage.deleteClip(clipId);
    if (!deleted) return res.status(404).json({ message: "Clip not found" });
    res.json({ success: true });
  });

  app.post(api.clips.vote.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const { value } = req.body;
    const clipId = parseInt(req.params.id);
    const userId = (req.user as any).id;
    const existingVote = await storage.getVote(userId, clipId);
    if (existingVote) {
      if (existingVote.value === value) await storage.deleteVote(existingVote.id);
      else await storage.updateVote(existingVote.id, value);
    } else {
      await storage.submitVote({ userId, clipId, value });
    }
    await storage.updateClipVotes(clipId);
    const clip = await storage.getClip(clipId);
    res.json({ upvotes: clip?.upvotes || 0, downvotes: clip?.downvotes || 0 });
  });

  app.post(api.clips.fetchMetadata.path, async (req, res) => {
    try {
      const metadata = isKickUrl(req.body.url)
        ? await fetchKickMetadata(req.body.url)
        : await fetchYouTubeMetadata(req.body.url);
      res.json(metadata);
    } catch {
      res.status(400).json({ message: "Invalid URL" });
    }
  });

  // ✅ يحوّل أي رابط (YouTube أو Kick) إلى videoId + timestamps + platform
  app.get("/api/resolve-url", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ message: "url required" });
    try {
      const meta = isKickUrl(url)
        ? await fetchKickMetadata(url)
        : await fetchYouTubeMetadata(url);

      // ─── إذا الـ convertedUrl هو embed URL، أرجعه مباشرة ──
      const isEmbedUrl = /youtube(-nocookie)?\.com\/embed\//i.test(meta.convertedUrl || "");

      res.json({
        platform:   meta.platform  || "youtube",
        videoId:    meta.videoId   || null,
        startTime:  meta.startTime || 0,
        endTime:    meta.endTime   || 0,
        embedUrl:   isEmbedUrl ? meta.convertedUrl : null,
        title:      meta.title     || null,
        thumbnailUrl: meta.thumbnailUrl || null,
      });
    } catch {
      res.status(400).json({ message: "Could not resolve URL" });
    }
  });

  // ─── Artworks (رسامين دريم) ────────────────────────────────

  // GET /api/artworks?status=approved|pending|rejected
  app.get("/api/artworks", async (req, res) => {
    const status = (req.query.status as string) || "approved";
    // الأدمن فقط يرى الانتظار والمرفوض
    if (status !== "approved" && (!req.isAuthenticated() || (req.user as any).role !== "admin")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!pool) return res.json([]);
    const c = await pool.connect();
    try {
      const r = await c.query(
        `SELECT id, image_data AS "imageData", artist_name AS "artistName",
                artist_avatar AS "artistAvatar", status, created_at AS "createdAt"
         FROM artworks WHERE status = $1 ORDER BY created_at DESC`,
        [status]
      );
      res.json(r.rows);
    } finally { c.release(); }
  });

  // POST /api/artworks
  app.post("/api/artworks", async (req, res) => {
    const { imageData, artistName, artistAvatar } = req.body;
    if (!imageData || !imageData.startsWith("data:image")) {
      return res.status(400).json({ message: "Invalid image data" });
    }
    if (!pool) return res.status(500).json({ message: "No DB" });
    const c = await pool.connect();
    try {
      const r = await c.query(
        `INSERT INTO artworks (image_data, artist_name, artist_avatar, status)
         VALUES ($1, $2, $3, 'pending') RETURNING id, artist_name AS "artistName", status, created_at AS "createdAt"`,
        [imageData, (artistName || "زائر").slice(0, 30), artistAvatar || null]
      );
      res.status(201).json(r.rows[0]);
    } finally { c.release(); }
  });

  // PATCH /api/artworks/:id/status
  app.patch("/api/artworks/:id/status", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin")
      return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!["approved","rejected","pending"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    if (!pool) return res.status(500).json({ message: "No DB" });
    const c = await pool.connect();
    try {
      await c.query(`UPDATE artworks SET status = $1 WHERE id = $2`, [status, id]);
      res.json({ success: true });
    } finally { c.release(); }
  });

  // DELETE /api/artworks/:id
  app.delete("/api/artworks/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin")
      return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (!pool) return res.status(500).json({ message: "No DB" });
    const c = await pool.connect();
    try {
      await c.query(`DELETE FROM artworks WHERE id = $1`, [id]);
      res.json({ success: true });
    } finally { c.release(); }
  });

  return httpServer;
}

// ─────────────────────────────────────────────────────────────
//  Helpers — مشتركة بين YouTube و Kick
// ─────────────────────────────────────────────────────────────

/** تحوّل عدد الثواني إلى نص مثل "1:23" أو "1:02:05" */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:30";
  const hrs  = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
//  Kick Helpers
// ─────────────────────────────────────────────────────────────

/** هل الرابط من Kick؟ */
function isKickUrl(url: string): boolean {
  return /kick\.com/i.test(url);
}

/**
 * يستخرج معرّف الكليب (slug) من روابط Kick المختلفة:
 *   https://kick.com/clip/CLIP_ID
 *   https://kick.com/username/clips/CLIP_ID   ← الشكل الجديد
 *   https://kick.com/username/clip/CLIP_ID    (رابط قديم)
 *   https://kick.com/video/CLIP_ID
 */
function extractKickClipId(url: string): string | null {
  const patterns = [
    /kick\.com\/clip\/([A-Za-z0-9_-]+)/i,
    /kick\.com\/[^/]+\/clips?\/([A-Za-z0-9_-]+)/i,   // clips أو clip
    /kick\.com\/clips\/([A-Za-z0-9_-]+)/i,
    /kick\.com\/video\/([A-Za-z0-9_-]+)/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * يجلب البيانات الوصفية لكليب Kick
 * يجرب عدة APIs ويستخرج الـ clipId بشكل صحيح
 */
async function fetchKickMetadata(clipUrl: string) {
  const clipId = extractKickClipId(clipUrl);
  console.log("[Kick] clipUrl:", clipUrl, "→ clipId:", clipId);

  if (clipId) {
    // جرب عدة APIs بما فيها oEmbed
    const apiEndpoints = [
      `https://kick.com/api/v2/clips/${clipId}`,
      `https://kick.com/api/v1/clips/${clipId}`,
      `https://kick.com/api/v2/clips?clip_id=${clipId}`,
    ];

    for (const endpoint of apiEndpoints) {
      try {
        const resp = await fetch(endpoint, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept":     "application/json, text/plain, */*",
            "Referer":    "https://kick.com/",
            "Origin":     "https://kick.com",
          },
          signal: AbortSignal.timeout(10000),
        });
        console.log("[Kick] API", endpoint, "status:", resp.status);
        if (resp.ok) {
          const data = await resp.json() as any;
          // Kick API قد يُرجع البيانات مباشرة أو داخل .clip أو .data
          const clip    = data?.clip ?? data?.data?.clip ?? data?.data ?? data;
          const title   = clip?.title || clip?.clip_title || `Kick Clip`;
          const thumb   = clip?.thumbnail_url || clip?.thumbnail || clip?.thumb || clip?.clip_thumbnail || "";
          const channel = clip?.channel?.slug || clip?.channel?.username || clip?.streamer?.username || clip?.channel_name || "Kick";
          const dur     = typeof clip?.duration === "number" ? clip.duration : (typeof clip?.duration_seconds === "number" ? clip.duration_seconds : 30);
          console.log("[Kick] Got metadata:", { title, thumb, channel });
          return {
            convertedUrl: clipUrl,
            platform:     "kick" as const,
            title,
            thumbnailUrl: thumb,
            channelName:  channel,
            duration:     formatDuration(dur),
            videoId:      clipId,
            startTime:    0,
            endTime:      0,
          };
        }
      } catch (err) {
        console.warn("[fetchKickMetadata] API failed:", endpoint, err);
      }
    }
  }

  // Fallback — البيانات من URL فقط
  console.warn("[Kick] Using fallback metadata for:", clipUrl);
  return {
    convertedUrl: clipUrl,
    platform:     "kick" as const,
    title:        clipId ? `Kick Clip — ${clipId}` : "Kick Clip",
    thumbnailUrl: "",
    channelName:  "Kick",
    duration:     "0:30",
    videoId:      clipId ?? "",
    startTime:    0,
    endTime:      0,
  };
}

// ─────────────────────────────────────────────────────────────
//  YouTube Helpers
// ─────────────────────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  return url.match(/[?&]v=([\w-]{11})/)?.[1] || url.match(/youtu\.be\/([\w-]{11})/)?.[1] || null;
}

async function fetchYouTubeMetadata(clipUrl: string) {
  const isYouTubeClip = /youtube\.com\/clip\//.test(clipUrl);

  if (isYouTubeClip) {
    // ─── استخراج clip ID ────────────────────────────────────
    const clipId = clipUrl.match(/\/clip\/([A-Za-z0-9_-]+)/)?.[1] ?? "";
    console.log("[YT Clip] clipId:", clipId, "url:", clipUrl);

    try {
      // ─── oEmbed يُعيد HTML embed كامل مع كل المعاملات ────
      const resp = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(clipUrl)}&format=json`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      console.log("[YT Clip] oEmbed status:", resp.status);

      if (resp.ok) {
        const data = await resp.json() as any;
        console.log("[YT Clip] oEmbed data:", JSON.stringify(data).slice(0, 300));

        const html: string = data?.html ?? "";
        const videoId = (data?.thumbnail_url as string)?.match(/\/vi\/([\w-]{11})\//)?.[1] ?? null;

        // ─── استخراج src الكامل من HTML embed ──────────────
        const srcMatch = html.match(/src="([^"]+)"/);
        const embedSrc = srcMatch?.[1] ?? "";
        console.log("[YT Clip] embed src:", embedSrc);

        // ─── استخراج clip + clipt params من src ──────────
        let embedUrl: string;
        if (embedSrc.includes("clip=") || embedSrc.includes("clipt=")) {
          // نستخدم الـ src مباشرة مع إضافة autoplay
          try {
            const u = new URL(embedSrc);
            u.searchParams.set("autoplay", "1");
            u.searchParams.set("rel", "0");
            // تحويل إلى youtube-nocookie للخصوصية
            embedUrl = u.toString().replace("www.youtube.com/embed", "www.youtube-nocookie.com/embed");
          } catch {
            embedUrl = embedSrc;
          }
        } else if (videoId && clipId) {
          // fallback: بناء embed URL مع clip parameter
          embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?clip=${clipId}&autoplay=1&rel=0`;
        } else {
          embedUrl = embedSrc || clipUrl;
        }

        const startTime = parseInt(new URL(embedSrc || "https://x.com").searchParams.get("start") ?? "0") || 0;
        const endTime   = parseInt(new URL(embedSrc || "https://x.com").searchParams.get("end") ?? "0") || 0;
        const clipDuration = startTime && endTime && endTime > startTime ? endTime - startTime : 30;

        console.log("[YT Clip] Final embedUrl:", embedUrl);

        return {
          convertedUrl: embedUrl, // ✅ نحفظ embed URL مباشرة
          platform:     "youtube" as const,
          title:        (data.title as string) || "Gaming Clip",
          thumbnailUrl: (data.thumbnail_url as string) || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ""),
          channelName:  (data.author_name as string) || "Unknown Channel",
          duration:     formatDuration(clipDuration),
          videoId:      videoId ?? clipId,
          startTime,
          endTime,
        };
      }
    } catch (err) {
      console.warn("[fetchYouTubeMetadata] oEmbed failed:", err);
    }

    // ─── Fallback: حفظ الرابط الأصلي للكليب ──────────────
    // السيرفر سيحاول مرة أخرى عند العرض
    return {
      convertedUrl: clipUrl,
      platform:     "youtube" as const,
      title:        "Gaming Clip",
      thumbnailUrl: "",
      channelName:  "YouTube Clip",
      duration:     "0:30",
      videoId:      clipId,
      startTime:    0,
      endTime:      0,
    };
  }

  // ─── فيديو YouTube عادي (watch?v=...) ────────────────────
  const videoId = extractVideoId(clipUrl) ?? "";
  const urlObj  = (() => { try { return new URL(clipUrl); } catch { return null; } })();
  const startTime = parseInt(urlObj?.searchParams.get("start") ?? "0") || 0;
  const endTime   = parseInt(urlObj?.searchParams.get("end")   ?? "0") || 0;

  if (videoId) {
    // جرب oEmbed للعنوان والـ thumbnail
    try {
      const resp = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(clipUrl)}&format=json`,
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) }
      );
      if (resp.ok) {
        const data = await resp.json() as any;
        return {
          convertedUrl: clipUrl,
          platform:     "youtube" as const,
          title:        (data.title as string) || "Gaming Clip",
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          channelName:  (data.author_name as string) || "YouTube",
          duration:     formatDuration(endTime - startTime || 30),
          videoId,
          startTime,
          endTime,
        };
      }
    } catch {}
  }

  return {
    convertedUrl: clipUrl,
    platform:     "youtube" as const,
    title:        "Gaming Clip",
    thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "",
    channelName:  "Unknown Channel",
    duration:     formatDuration(endTime - startTime || 30),
    videoId,
    startTime,
    endTime,
  };
}
