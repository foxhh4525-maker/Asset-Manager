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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
      const metadata = await mockYouTubeMetadata(input.url);
      const clip = await storage.createClip({
        ...input,
        ...metadata,
        submittedBy: (req.user as any).id,
        upvotes: 0,
        downvotes: 0,
        status: "pending",
      });
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

  app.post(api.clips.fetchMetadata.path, async (req, res) => {
    try {
      const { url } = req.body;
      const metadata = await mockYouTubeMetadata(url);
      res.json(metadata);
    } catch (error) {
      res.status(400).json({ message: "Invalid YouTube URL" });
    }
  });

  // ✅ Endpoint لجلب Video ID من رابط YouTube Clip
  app.get("/api/youtube/resolve-clip", async (req, res) => {
    const { url } = req.query as { url: string };
    if (!url) return res.status(400).json({ message: "URL required" });
    try {
      // استخراج clipId من الرابط
      const clipMatch = url.match(/clip\/([\w-]+)/);
      if (!clipMatch) return res.status(400).json({ message: "Invalid clip URL" });
      const clipId = clipMatch[1];

      // جلب صفحة الكليب واستخراج بيانات JSON منها
      const pageRes = await fetch(`https://www.youtube.com/clip/${clipId}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      const html = await pageRes.text();

      // استخراج videoId
      const videoIdMatch = html.match(/"videoDetails":\{"videoId":"([\w-]{11})"/);
      if (!videoIdMatch) return res.status(404).json({ message: "Could not extract videoId" });
      const videoId = videoIdMatch[1];

      // استخراج وقت البداية والنهاية للكليب (بالميلي ثانية)
      const startMsMatch = html.match(/"startTimeMs":"(\d+)"/);
      const endMsMatch   = html.match(/"endTimeMs":"(\d+)"/);
      const startSec = startMsMatch ? Math.floor(parseInt(startMsMatch[1]) / 1000) : 0;
      const endSec   = endMsMatch   ? Math.floor(parseInt(endMsMatch[1])   / 1000) : 0;

      return res.json({ videoId, startTime: startSec, endTime: endSec });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ✅ studioHandler محذوف — كان يعيد التوجيه لـ / ويمنع الوصول للصفحة
  // Vite يخدم index.html لكل المسارات غير المعروفة تلقائياً

  return httpServer;
}

async function mockYouTubeMetadata(url: string) {
  await new Promise((r) => setTimeout(r, 500));
  const idMatch = url.match(/clip\/([a-zA-Z0-9_-]+)/);
  const id = idMatch ? idMatch[1] : "unknown";
  return {
    title: `Amazing Clip #${id.substring(0, 5)}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    channelName: "Random Streamer",
    duration: "0:30",
  };
}
