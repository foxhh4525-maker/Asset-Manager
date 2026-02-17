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
  // Session setup - use Postgres-backed session store for persistence
    const PgSession = connectPgSimple(session as any);
  // Determine whether we are behind a proxy
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
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Setup Passport Discord Strategy if credentials are available
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

    app.get(
      "/api/auth/discord",
      passport.authenticate("discord", { scope: ["identify", "email"] })
    );

    app.get(
      "/api/auth/callback/discord",
      passport.authenticate("discord", { failureRedirect: "/" }),
      (req, res) => {
        req.session?.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.redirect("/");
          }

          try {
            console.log("Authenticated user id:", (req.user as any)?.id);
            console.log("Session ID:", (req.session as any)?.id || (req.sessionID as any));
          } catch (e) {}

          // ✅ توجيه الأدمن مباشرةً للاستديو بعد تسجيل الدخول
          const user = req.user as any;
          let redirectPath = "/";
          if (user?.role === "admin") redirectPath = "/studio";
          else if (user?.role === "streamer") redirectPath = "/dashboard";

          res.redirect(`${redirectPath}?auth=${Date.now()}`);
        });
      }
    );
  } else {
    // Mock Auth for Development
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
    const user = await storage.getUser(id);
    done(null, user);
  });

  // Auth Routes
  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.sendStatus(200);
    });
  });

  // Clips Routes
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
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // ✅ حماية مسار updateStatus — فقط الأدمن يقدر يغير الحالة
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

  // ✅ تم حذف studioHandler الذي كان يعيد التوجيه لـ /
  // Vite يتعامل مع client-side routing تلقائياً في بيئة التطوير
  // وفي الإنتاج، vite.ts يعيد index.html لكل المسارات غير المعروفة

  return httpServer;
}

// Mock Helper
async function mockYouTubeMetadata(url: string) {
  await new Promise(r => setTimeout(r, 500));

  const idMatch = url.match(/clip\/([a-zA-Z0-9_-]+)/);
  const id = idMatch ? idMatch[1] : "unknown";

  return {
    title: `Amazing Clip #${id.substring(0, 5)}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    channelName: "Random Streamer",
    duration: "0:30",
  };
}
