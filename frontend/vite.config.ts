// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Import your cards JSON so we can derive offline routes
import serviceCards from "./src/metadata/serviceCards.json";

// Match the shape of your JSON
type ServiceCardConfig = {
  id: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
  offlineEnabled?: boolean;
};

const typedServiceCards = serviceCards as ServiceCardConfig[];

// Build regex list for all offline-enabled card paths
const offlineEnabledRoutePatterns = typedServiceCards
  .filter((card) => card.offlineEnabled)
  .map((card) => {
    // escape special regex chars in the path, just in case
    const escapedPath = card.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // e.g. "/text-to-qr" -> /^\/text-to-qr$/
    return new RegExp(`^${escapedPath}$`);
  });

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
        name: "My App",
        short_name: "MyApp",
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

        // ✅ Homepage ("/") + any card with offlineEnabled: true
        navigateFallbackAllowlist: [
          /^\/$/, // always allow the homepage
          ...offlineEnabledRoutePatterns,
        ],

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
