import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  // Load Replit dev plugins dynamically (only in dev + Replit environment)
  const replitPlugins: any[] = [];
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    try {
      const [overlay, cartographer, banner] = await Promise.all([
        import("@replit/vite-plugin-runtime-error-modal"),
        import("@replit/vite-plugin-cartographer"),
        import("@replit/vite-plugin-dev-banner"),
      ]);
      replitPlugins.push(
        overlay.default(),
        cartographer.cartographer(),
        banner.devBanner(),
      );
    } catch {
      // Plugins not available, skip
    }
  }

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    plugins: [
      ...(viteConfig.plugins ?? []),
      ...replitPlugins,
    ],
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk in case it changes
      // Use the file mtime as a cache-busting query param so the value
      // remains stable between reloads unless the file actually changes.
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      try {
        const st = await fs.promises.stat(clientTemplate);
        const mtime = Math.floor(st.mtimeMs);
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${mtime}"`,
        );
      } catch {
        // fallback to a random id if stat fails
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`,
        );
      }
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
