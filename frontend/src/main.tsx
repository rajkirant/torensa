import React from "react";
import ReactDOM from "react-dom/client";
import { Root } from "./Root";

import { registerSW } from "virtual:pwa-register";
import { setServiceWorkerUpdater } from "./utils/buildSync";

const updateSW = registerSW({
  immediate: true, // auto-update SW when online
});
setServiceWorkerUpdater(updateSW);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
