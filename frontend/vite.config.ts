// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import serviceCards from "./src/metadata/serviceCards.json";

type ServiceCardConfig = {
  id: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
  offlineEnabled?: boolean;
};

const typedServiceCards = serviceCards as ServiceCardConfig[];

// Generate regex for each offline-enabled route
const offlineRouteRegexes = typedServiceCards
  .filter((card) => card.offlineEnabled)
  .map(
    (card) =>
      new RegExp(`^${card.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  );

// Always allow homepage as fallback
offlineRouteRegexes.unshift(/^\/$/);

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
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: offlineRouteRegexes,
        cleanupOutdatedCaches: true,
      },
    }),
  ],

  server: {
    proxy: {
      "/api": {
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

          // ---- Everything else ----
          return "vendor";
        },
      },
    },
  },
});
