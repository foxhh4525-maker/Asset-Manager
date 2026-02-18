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

      const metadata = await fetchYouTubeMetadata(input.url);

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
      const metadata = await fetchYouTubeMetadata(req.body.url);
      res.json(metadata);
    } catch {
      res.status(400).json({ message: "Invalid YouTube URL" });
    }
  });


  return httpServer;
}

// ─────────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:30";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function extractVideoId(url: string): string | null {
  return url.match(/[?&]v=([\w-]{11})/)?.[1] || url.match(/youtu\.be\/([\w-]{11})/)?.[1] || null;
}

async function fetchYouTubeMetadata(clipUrl: string) {
  const isClip = /youtube\.com\/clip\//.test(clipUrl);

  if (isClip) {
    try {
      const resp = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(clipUrl)}&format=json`,
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
      );
      if (resp.ok) {
        const data = await resp.json() as any;
        const videoId = (data?.thumbnail_url as string)?.match(/\/vi\/([\w-]{11})\//)?.[1] ?? null;
        const html: string = data?.html ?? "";
        const startTime = parseInt(html.match(/[?&]start=(\d+)/)?.[1] ?? "0") || 0;
        const endTime   = parseInt(html.match(/[?&]end=(\d+)/)?.[1]   ?? "0") || 0;
        const clipDuration = startTime && endTime && endTime > startTime ? endTime - startTime : 30;
        return {
          convertedUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}&start=${startTime}&end=${endTime}` : clipUrl,
          title:        (data.title as string) || "Gaming Clip",
          thumbnailUrl: (data.thumbnail_url as string) || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ""),
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
