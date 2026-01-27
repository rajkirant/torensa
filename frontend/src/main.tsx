import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/styles.css";
import { Root } from "./Root";

// Register service worker (PWA) — auto update enabled
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true, // 🔥 auto-update SW on page load
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
