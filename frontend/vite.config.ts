// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
        // 💡 Only allow offline fallback for /text-to-qr
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: [/^\/text-to-qr$/],

        // (optional) any extra runtime caching, e.g. APIs or images
        // runtimeCaching: [
        //   {
        //     urlPattern: /\/text-to-qr$/,
        //     handler: "NetworkFirst",
        //     options: {
        //       cacheName: "text-to-qr-page-cache",
        //       cacheableResponse: { statuses: [0, 200] },
        //     },
        //   },
        // ],
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
