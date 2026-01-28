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

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 🔁 auto-update SW when a new version is available
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "robots.txt",
        "apple-touch-icon.png",
      ],

      manifest: {
        name: "Torensa Toolbox",
        short_name: "Torensa Tools",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },

      workbox: {
        // SPA fallback HTML
        navigateFallback: "/index.html",

        // ✅ Allow offline SPA fallback for BOTH:
        // - homepage:        /
        // - QR page:         /text-to-qr
        navigateFallbackAllowlist: offlineRouteRegexes,

        // clean up old precaches on new deploys
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react")) return "react-vendor";
            if (
              id.includes("@mui/material") ||
              id.includes("@mui/icons-material")
            ) {
              return "mui-vendor";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
