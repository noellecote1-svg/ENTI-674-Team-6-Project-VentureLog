/**
 * vite.config.ts — Vite Build Tool Configuration
 *
 * Configures Vite — the development server and build tool for VentureLog's
 * frontend. Vite serves the app during development and bundles it for
 * production deployment.
 *
 * Key configuration:
 *
 * base: Sets the URL base path from the BASE_PATH environment variable.
 *   Allows the app to be served from a subdirectory (e.g. /venturelog/)
 *   rather than always assuming it's at the root ("/").
 *
 * plugins:
 *   - react(): Enables React JSX/TSX support and Fast Refresh
 *     (instantly reflects code changes in the browser without full reload)
 *   - tailwindcss(): Processes Tailwind CSS utility classes at build time
 *   - runtimeErrorOverlay(): Development-only — shows a readable error
 *     overlay in the browser when a runtime error occurs (Replit specific)
 *   - cartographer(): Development-only — Replit's file mapping tool
 *   - devBanner(): Development-only — Replit's dev environment banner
 *
 * resolve.alias:
 *   - "@" maps to the src/ folder — allows imports like "@/components/..."
 *     instead of "../../../components/..." (used throughout the codebase)
 *   - "@assets" maps to the shared attached_assets folder at the monorepo root
 *
 * resolve.dedupe: Prevents duplicate React instances which would cause
 *   "hooks can only be called inside a function component" errors when
 *   multiple packages each bundle their own copy of React.
 *
 * build.outDir: Compiled production files go to dist/public/
 *
 * server/preview: Both dev server and preview server listen on the PORT
 *   environment variable, bound to all network interfaces (0.0.0.0)
 *   so the app is accessible inside Replit's container environment.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// ─── PORT VALIDATION ──────────────────────────────────────────────────────────
// Both the dev server and preview server need a valid PORT.
// Fail fast with a clear error rather than starting on an undefined port.
const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── BASE PATH VALIDATION ─────────────────────────────────────────────────────
// BASE_PATH allows the app to be hosted at a subdirectory (e.g. /venturelog/).
// Required so Vite generates correct asset URLs in the production build.
const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  // URL base path for all assets and routes
  base: basePath,

  plugins: [
    react(),         // React JSX support + Fast Refresh for instant dev updates
    tailwindcss(),   // Process Tailwind utility classes

    // Development-only plugins (not included in production builds)
    // Also skipped when not running inside a Replit environment
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          runtimeErrorOverlay(), // Shows readable error overlays in the browser
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],

  resolve: {
    alias: {
      // "@" → src/ — enables clean absolute imports throughout the codebase
      "@": path.resolve(import.meta.dirname, "src"),
      // "@assets" → shared attached_assets at the monorepo root
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    // Prevent duplicate React instances across monorepo packages
    dedupe: ["react", "react-dom"],
  },

  // Root is the venturelog package directory
  root: path.resolve(import.meta.dirname),

  build: {
    // Production build output goes to dist/public/
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true, // Clear the output directory before each build
  },

  server: {
    port,
    host: "0.0.0.0",     // Listen on all interfaces so Replit can access it
    allowedHosts: true,   // Allow any hostname (needed for Replit's proxy)
    fs: {
      strict: true,
      deny: ["**/.*"],    // Block access to hidden files (e.g. .env) for security
    },
  },

  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
