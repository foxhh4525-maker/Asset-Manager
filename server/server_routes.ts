import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import express from "express";
import path from "path";
import { existsSync, mkdirSync } from "fs";
import {
  downloadAndStoreVideo,
  VIDEOS_DIR,
  getLocalVideoUrl,
  getLocalVideoPath,
} from "./VideoDownloadr";
import { storage as st } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ── تقديم الفيديوهات المحلية ──────────────────────────────
  if (!existsSync(VIDEOS_DIR)) mkdirSync(VIDEOS_DIR, { recursive: true });
  app.use("/api/videos", express.static(VIDEOS_DIR, {
    setHeaders: (res) => {
      res.set("Accept-Ranges", "bytes");
      res.set("Cache-Control", "public, max-age=86400");
    },
  }));

  const PgSession = connectPgSimple(session as any);
  const isProd = process.env.NODE_ENV === "production";
  const trustProxy = !!process.env.TRUST_PROXY || isProd;
  const publicUrl = process.env.NEXTAUTH_URL || process.env.DISCORD_CALLBACK_URL || "";
  const cookieSecure = isProd || publicUrl.startsWith("https://");
  const cookieSameSite: any = cookieSecure ? "none" : "lax";

  let store: any;
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.tables WHERE table_name = 'session'
            ) THEN
              CREATE TABLE "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
              ) WITH (OIDS=FALSE);
              ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
              CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
            END IF;
          END
          $$;
        `);
        console.log("Ensured session table exists");
      } finally {
        client.release();
      }
    } catch (e: any) {
      console.warn("Could not ensure session table exists:", e?.message || e);
    }
    store = new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    });
    store.on && store.on("error", (err: any) => {
      console.error("Session store error:", err);
    });
  } else {
    console.warn("No database pool available — using in-memory session store.");
    const MemoryStore = (session as any).MemoryStore || (session as any).Store;
    store = new MemoryStore();
  }

  app.use(
    session({
      store,
      name: process.env.SESSION_COOKIE_NAME || "connect.sid",
      secret: process.env.SESSION_SECRET || "dev_secret",
      resave: false,
      saveUninitialized: false,
      proxy: trustProxy,
      cookie: {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    passport.use(
      new DiscordStrategy(
        {
          clientID: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
          callbackURL: "https://asset-manager--hichamadmin.replit.app/api/auth/callback/discord",
          scope: ["identify", "email"],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            let user = await storage.getUserByDiscordId(profile.id);
            if (!user) {
              user = await storage.createUser({
                discordId: profile.id,
                username: profile.username,
                avatarUrl: profile.avatar
                  ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                  : `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`,
                role: "user",
              } as any);
            }
            done(null, user);
          } catch (error) {
            done(error);
          }
        }
      )
    );

    app.get("/api/auth/discord", passport.authenticate("discord", { scope: ["identify", "email"] }));

    app.get(
      "/api/auth/callback/discord",
      passport.authenticate("discord", { failureRedirect: "/" }),
      (req, res) => {
        req.session?.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.redirect("/");
          }
          const user = req.user as any;
          let redirectPath = "/";
          if (user?.role === "admin") redirectPath = "/studio";
          else if (user?.role === "streamer") redirectPath = "/dashboard";
          res.redirect(`${redirectPath}?auth=${Date.now()}`);
        });
      }
    );
  } else {
    app.get("/api/auth/discord", async (req, res) => {
      let user = await storage.getUserByUsername("StreamerDemo");
      if (!user) {
        user = await storage.createUser({
          discordId: "demo-streamer-id",
          username: "StreamerDemo",
          avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Streamer",
          role: "streamer",
        } as any);
      }
      req.login(user, (err) => {
        if (err) return res.status(500).send("Login failed");
        return res.redirect("/");
      });
    });
  }

  app.post("/api/auth/mock-login", async (req, res) => {
    let user = await storage.getUserByUsername("StreamerDemo");
    if (!user) {
      user = await storage.createUser({
        discordId: "mock-discord-id",
        username: "StreamerDemo",
        avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
        role: "streamer",
      } as any);
    }
    req.login(user, (err) => {
      if (err) return res.status(500).json({ message: "Login failed" });
      return res.json(user);
    });
  });

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    // ✅ يجلب المستخدم من قاعدة البيانات في كل طلب — يضمن أن الدور دائماً محدّث
    const user = await storage.getUser(id);
    done(null, user);
  });

  // ─── Auth Routes ───────────────────────────────────────────

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  // ✅ Endpoint مؤقت للتشخيص — يُظهر بيانات المستخدم الكاملة بما فيها الدور
  app.get("/api/debug/me", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.json({ authenticated: false, message: "Not logged in" });
    }
    const user = req.user as any;
    res.json({
      authenticated: true,
      id: user.id,
      username: user.username,
      role: user.role,
      discordId: user.discordId,
      isAdmin: user.role === "admin",
    });
  });

  // ✅ Endpoint لترقية الحساب الحالي إلى Admin مباشرةً (استخدم مرة واحدة ثم احذفه)
  app.get("/api/debug/make-admin", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    try {
      if (!pool) {
        return res.status(500).json({ message: "No database connection" });
      }
      const client = await pool.connect();
      try {
        await client.query(
          `UPDATE users SET role = 'admin' WHERE id = $1`,
          [user.id]
        );
        // تحديث الجلسة الحالية فوراً
        (req.user as any).role = "admin";
        req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Session save failed" });
          res.redirect("/studio");
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.sendStatus(200);
    });
  });

  // ─── Clips Routes ──────────────────────────────────────────

  app.get(api.clips.list.path, async (req, res) => {
    const { status, sort } = req.query as { status?: string; sort?: string };
    const clips = await storage.getClips({ status, sort });
    res.json(clips);
  });

  app.post(api.clips.create.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Must be logged in to submit clips" });
    }
    try {
      const input = api.clips.create.input.parse(req.body);
      const metadata = await fetchYouTubeMetadata(input.url);
      const clip = await storage.createClip({
        ...input,
        // ✅ نخزّن الرابط المحوّل (watch?v=...) بدلاً من رابط /clip/ المكسور
        url:          metadata.convertedUrl,
        title:        metadata.title,
        thumbnailUrl: metadata.thumbnailUrl,
        channelName:  metadata.channelName,
        duration:     metadata.duration,
        submittedBy:  (req.user as any).id,
        upvotes:   0,
        downvotes: 0,
        status:    "pending",
      });

      // ── تحميل الفيديو في الخلفية ────────────────────────
      if (metadata.videoId) {
        (async () => {
          try {
            const { localUrl } = await downloadAndStoreVideo(
              metadata.videoId,
              metadata.startTime,
              metadata.endTime
            );
            if (localUrl) {
              await storage.updateClipUrl(clip.id, localUrl);
              console.log(`[clip ${clip.id}] video stored: ${localUrl}`);
            }
          } catch (e) {
            console.warn(`[clip ${clip.id}] background download failed:`, e);
          }
        })();
      }

      res.status(201).json(clip);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.patch(api.clips.updateStatus.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    const { status } = req.body;
    const clipId = parseInt(req.params.id);
    const updated = await storage.updateClipStatus(clipId, status);
    if (!updated) return res.status(404).json({ message: "Clip not found" });
    res.json(updated);
  });

  // ── حذف مقطع (للمشرفين فقط) ──────────────────────────────
  app.delete("/api/clips/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    const clipId = parseInt(req.params.id);
    if (isNaN(clipId)) return res.status(400).json({ message: "Invalid clip ID" });
    const deleted = await storage.deleteClip(clipId);
    if (!deleted) return res.status(404).json({ message: "Clip not found" });
    res.json({ success: true });
  });

  app.post(api.clips.vote.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { value } = req.body;
    const clipId = parseInt(req.params.id);
    const userId = (req.user as any).id;
    const existingVote = await storage.getVote(userId, clipId);
    if (existingVote) {
      if (existingVote.value === value) {
        await storage.deleteVote(existingVote.id);
      } else {
        await storage.updateVote(existingVote.id, value);
      }
    } else {
      await storage.submitVote({ userId, clipId, value });
    }
    await storage.updateClipVotes(clipId);
    const clip = await storage.getClip(clipId);
    res.json({ upvotes: clip?.upvotes || 0, downvotes: clip?.downvotes || 0 });
  });

  // ── إعادة تحميل كل الكليبات المكسورة (للأدمن) ────────────
  app.post("/api/admin/redownload-clips", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any)?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    // جلب كل الكليبات التي رابطها يوتيوب (مش محلي)
    const clips = await storage.getClips({ status: "approved", sort: "new" });
    const pending = clips.filter(
      (c: any) => !c.url?.startsWith("/api/videos/")
    );
    res.json({ total: pending.length, message: "Re-download started in background" });

    // معالجة في الخلفية
    (async () => {
      for (const clip of pending as any[]) {
        try {
          const parsed = (() => {
            try {
              const u = new URL(clip.url);
              const videoId = u.searchParams.get("v") || null;
              const start = parseInt(u.searchParams.get("start") ?? "0") || 0;
              const end   = parseInt(u.searchParams.get("end")   ?? "0") || 0;
              return { videoId, start, end };
            } catch { return { videoId: null, start: 0, end: 0 }; }
          })();

          if (!parsed.videoId) continue;

          const { localUrl } = await downloadAndStoreVideo(
            parsed.videoId, parsed.start, parsed.end
          );
          if (localUrl) {
            await storage.updateClipUrl(clip.id, localUrl);
            console.log(`[redownload] clip ${clip.id} -> ${localUrl}`);
          }
        } catch (e) {
          console.warn(`[redownload] clip ${(clip as any).id} failed:`, e);
        }
      }
      console.log("[redownload] All done.");
    })();
  });

  app.post(api.clips.fetchMetadata.path, async (req, res) => {
    try {
      const { url } = req.body;
      const metadata = await fetchYouTubeMetadata(url);
      res.json(metadata);
    } catch (error) {
      res.status(400).json({ message: "Invalid YouTube URL" });
    }
  });

  // ✅ studioHandler محذوف — كان يعيد التوجيه لـ / ويمنع الوصول للصفحة
  // Vite يخدم index.html لكل المسارات غير المعروفة تلقائياً

  return httpServer;
}

// ─────────────────────────────────────────────────────────────
//  مساعد: تحويل ثوانٍ ← دقائق:ثواني
// ─────────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:30";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
//  مساعد: استخراج videoId من أي رابط YouTube
// ─────────────────────────────────────────────────────────────
function extractVideoId(url: string): string | null {
  return (
    url.match(/[?&]v=([\w-]{11})/)?.[1] ||
    url.match(/youtu\.be\/([\w-]{11})/)?.[1] ||
    null
  );
}

// ─────────────────────────────────────────────────────────────
//  الدالة الرئيسية: جلب بيانات الفيديو وتحويل رابط /clip/
// ─────────────────────────────────────────────────────────────
async function fetchYouTubeMetadata(clipUrl: string) {
  const isClip = /youtube\.com\/clip\//.test(clipUrl);

  if (isClip) {
    try {
      const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(clipUrl)}&format=json`;
      const resp = await fetch(oembedEndpoint, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });

      if (resp.ok) {
        const data = await resp.json() as any;

        // استخرج videoId من thumbnail_url
        const thumbMatch = (data?.thumbnail_url as string)?.match(/\/vi\/([\w-]{11})\//);
        const videoId = thumbMatch?.[1] ?? null;

        // استخرج start و end من HTML الـ iframe
        const html: string = data?.html ?? "";
        const startMatch = html.match(/[?&]start=(\d+)/);
        const endMatch   = html.match(/[?&]end=(\d+)/);
        const startTime  = startMatch ? parseInt(startMatch[1]) : 0;
        const endTime    = endMatch   ? parseInt(endMatch[1])   : 0;

        const clipDuration = startTime && endTime && endTime > startTime
          ? endTime - startTime
          : 30;

        const convertedUrl = videoId
          ? `https://www.youtube.com/watch?v=${videoId}&start=${startTime}&end=${endTime}`
          : clipUrl;

        return {
          convertedUrl,
          title:        (data.title as string) || "Gaming Clip",
          thumbnailUrl: (data.thumbnail_url as string) ||
                        (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ""),
          channelName:  (data.author_name as string) || "Unknown Channel",
          duration:     formatDuration(clipDuration),
          videoId:      videoId ?? "",
          startTime,
          endTime,
        };
      }
    } catch (err) {
      console.warn("[fetchYouTubeMetadata] oEmbed failed:", err);
    }
  }

  // ── fallback: روابط watch?v= العادية ──────────────────────
  const videoId = extractVideoId(clipUrl) ?? "";
  const urlObj  = (() => { try { return new URL(clipUrl); } catch { return null; } })();
  const startTime = parseInt(urlObj?.searchParams.get("start") ?? "0") || 0;
  const endTime   = parseInt(urlObj?.searchParams.get("end")   ?? "0") || 0;

  return {
    convertedUrl: clipUrl,
    title:        "Gaming Clip",
    thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "",
    channelName:  "Unknown Channel",
    duration:     formatDuration(endTime - startTime || 30),
    videoId,
    startTime,
    endTime,
  };
}
