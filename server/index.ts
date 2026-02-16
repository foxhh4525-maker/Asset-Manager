import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// If running behind a reverse proxy (e.g., Replit, Heroku), trust the proxy
// so secure cookies and redirects work as expected.
if (process.env.TRUST_PROXY || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run SQL migrations (idempotent) found in the migrations/ folder.
  // This ensures tables like the `session` table are present when the
  // app starts (useful for development and simple deployments).
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const { pool } = await import("./db");

    if (pool) {
      const client = await pool.connect();
      try {
        const migrationsDir = path.resolve(process.cwd(), "migrations");
        const files = await fs.readdir(migrationsDir);
        // sort to execute in deterministic order and run sequentially
        const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();
        for (const file of sqlFiles) {
          try {
            const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
            await client.query(sql);
            log(`Applied migration: ${file}`, "migrations");
          } catch (e: any) {
            // log and continue — migrations are written to be idempotent
            log(`Migration ${file} warning: ${e?.message || e}`, "migrations");
          }
        }
      } finally {
        client.release();
      }
    } else {
      log("No database pool available; skipping migrations.", "migrations");
    }
  } catch (err) {
    log(`Migration runner error: ${err}`);
  }
  // Ensure PostgreSQL enum has 'user' value for Discord signups
  try {
    const { pool } = await import("./db");
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_type t
              JOIN pg_enum e ON t.oid = e.enumtypid
              WHERE t.typname = 'user_role' AND e.enumlabel = 'user'
            ) THEN
              ALTER TYPE user_role ADD VALUE 'user' BEFORE 'streamer';
            END IF;
          END
          $$;
        `);
        log("Enum 'user_role' verified and updated if needed.");
      } finally {
        client.release();
      }
    }
  } catch (err: any) {
    // Log but don't fail if enum update fails (it might already exist)
    if (err.message && !err.message.includes("already exists")) {
      log(`Warning: Could not verify enum: ${err.message}`, "database");
    }
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
