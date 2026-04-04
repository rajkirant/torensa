import React from "react";
import ReactDOM from "react-dom/client";
import { Root } from "./Root";
import "./utils/language";

import { registerSW } from "virtual:pwa-register";
import { syncBuildFromStaticFile } from "./utils/buildSync";

registerSW({
  immediate: true, // auto-update SW when online
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

// Check for new build in the background; reloads the page if outdated.
void syncBuildFromStaticFile();
