import React from "react";
import ReactDOM from "react-dom/client";
import { Root } from "./Root";

import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true, // auto-update SW when online
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
