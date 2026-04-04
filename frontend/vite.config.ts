// vite.config.ts
import { readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import serviceCards from "./src/metadata/serviceCards.json";

type ServiceCardConfig = {
  id: string;
  component?: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
  offlineEnabled?: boolean;
  isActive?: boolean;
};

const typedServiceCards = serviceCards as ServiceCardConfig[];

function isCardActive(card: ServiceCardConfig) {
  return card.isActive !== false;
}

const offlinePaths = typedServiceCards
  .filter((card) => isCardActive(card) && card.offlineEnabled)
  .map((card) => card.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

// Always include homepage
offlinePaths.unshift("/");

// Combined RegExp for runtimeCaching urlPattern — must be a serializable RegExp,
// not a closure function. Matches each offline path with optional /de or /nl prefix.
const offlineNavPattern = new RegExp(
  `^(/(de|nl))?(${offlinePaths.join("|")})$`,
);

function componentChunkBase(component?: string) {
  if (!component) return null;
  const parts = component.split("/");
  return parts[parts.length - 1] || null;
}

function collectPageChunkBases(dirPath: string): string[] {
  const chunkBases: string[] = [];
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      chunkBases.push(...collectPageChunkBases(fullPath));
      continue;
    }
    if (stat.isFile() && extname(entry) === ".tsx") {
      chunkBases.push(entry.slice(0, -4));
    }
  }
  return chunkBases;
}

const pageChunkBases = collectPageChunkBases(
  resolve(process.cwd(), "src/pages"),
);

const offlineToolChunkBases = typedServiceCards
  .filter((card) => isCardActive(card) && card.offlineEnabled)
  .map((card) => componentChunkBase(card.component))
  .filter((name): name is string => Boolean(name));

const knownRouteChunkBases = new Set(pageChunkBases);

const allowedRouteChunkBases = new Set(["Home", ...offlineToolChunkBases]);

const excludedRouteChunkBases = Array.from(knownRouteChunkBases).filter(
  (base) => !allowedRouteChunkBases.has(base),
);

const workboxGlobIgnores = excludedRouteChunkBases.flatMap((base) => [
  `**/assets/${base}-*.js`,
  `**/assets/${base}-*.css`,
]);

const requiredSharedChunkBases = [
  // Required for app bootstrap and routing
  "index",
  "rolldown-runtime",
  "react-core",
  "react-router",
  "vendor",
  // UI libraries required by most offline tools
  "mui-core",
  "mui-icons",
  "emotion",
  // Layout chunk used across route pages
  "PageContainer",
  // PWA register helper chunk
  "workbox-window.prod.es5",
];

function matchesChunkBase(url: string, base: string) {
  return (
    url.startsWith(`assets/${base}-`) &&
    (url.endsWith(".js") || url.endsWith(".css"))
  );
}

function shouldKeepPrecacheUrl(url: string) {
  if (!url.startsWith("assets/")) return true;

  for (const base of knownRouteChunkBases) {
    if (!matchesChunkBase(url, base)) continue;
    return allowedRouteChunkBases.has(base);
  }

  for (const base of requiredSharedChunkBases) {
    if (matchesChunkBase(url, base)) return true;
  }

  // Keep unknown chunks by default to avoid breaking runtime.
  return true;
}

function isInNodeModules(id: string) {
  return id.includes("/node_modules/");
}

function fromPkg(id: string, pkg: string) {
  // Robust match for pnpm/npm/yarn layouts
  // Examples:
  //  - /node_modules/react/
  //  - /node_modules/.pnpm/react@18.2.0/node_modules/react/
  return (
    id.includes(`/node_modules/${pkg}/`) ||
    id.includes(`/node_modules/.pnpm/${pkg}@`) ||
    id.includes(`/node_modules/.pnpm/${pkg.replace("/", "+")}@`)
  );
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "robots.txt",
        "apple-touch-icon.png",
      ],

      manifest: {
        name: "Torensa Toolbox",
        short_name: "Torensa",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },

      workbox: {
        // navigateFallback serves /index.html (home page HTML) for SW-intercepted
        // navigations — causing a visible flash. Disabled in favour of NetworkFirst
        // runtimeCaching below, which fetches the correct pre-rendered HTML online
        // and falls back to the cached page when offline.
        navigateFallback: null,
        globIgnores: workboxGlobIgnores,
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.filter((entry) =>
              shouldKeepPrecacheUrl(entry.url),
            ),
            warnings: [],
          }),
        ],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Network-first for HTML navigations on offline-enabled routes.
            // Online → fetches the correct pre-rendered HTML (no home-page flash).
            // Offline → serves the cached response from a previous visit.
            urlPattern: offlineNavPattern,
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],

  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/ai": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },

  build: {
    // keep default minifier (esbuild) – fast & good
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!isInNodeModules(id)) return;

          // ---- React core ----
          if (
            fromPkg(id, "react") ||
            fromPkg(id, "react-dom") ||
            fromPkg(id, "scheduler")
          ) {
            return "react-core";
          }

          // ---- Router ----
          if (fromPkg(id, "react-router") || fromPkg(id, "react-router-dom")) {
            return "react-router";
          }

          // ---- MUI (split icons separately) ----
          if (fromPkg(id, "@mui/icons-material")) {
            return "mui-icons";
          }

          if (
            fromPkg(id, "@mui/material") ||
            fromPkg(id, "@mui/system") ||
            fromPkg(id, "@mui/base") ||
            fromPkg(id, "@mui/utils") ||
            fromPkg(id, "@mui/private-theming") ||
            fromPkg(id, "@mui/styled-engine")
          ) {
            return "mui-core";
          }

          // ---- Emotion (MUI styling engine) ----
          if (fromPkg(id, "@emotion/react") || fromPkg(id, "@emotion/styled")) {
            return "emotion";
          }

          // ---- Heavy feature libs (split to reduce giant vendor chunk) ----
          if (fromPkg(id, "pdf-lib")) {
            return "pdf-lib";
          }

          if (fromPkg(id, "jszip")) {
            return "jszip";
          }

          if (fromPkg(id, "read-excel-file")) {
            return "read-excel-file";
          }

          if (fromPkg(id, "qrcode")) {
            return "qrcode";
          }

          if (fromPkg(id, "jose")) {
            return "jose";
          }

          if (fromPkg(id, "diff")) {
            return "diff";
          }

          // ---- Everything else ----
          return "vendor";
        },
      },
    },
  },
});
