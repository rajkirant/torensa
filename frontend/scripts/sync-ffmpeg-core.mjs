import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const sourceDir = join(projectRoot, "node_modules", "@ffmpeg", "core", "dist", "esm");
const targetDir = join(projectRoot, "public", "vendor", "ffmpeg");

const files = [
  { source: "ffmpeg-core.js", target: "ffmpeg-core.esm.js" },
  { source: "ffmpeg-core.wasm", target: "ffmpeg-core.wasm" },
];

mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const source = join(sourceDir, file.source);
  const target = join(targetDir, file.target);
  if (!existsSync(source)) {
    throw new Error(`Missing source file: ${source}`);
  }
  copyFileSync(source, target);
}

console.log("Synced FFmpeg core files to public/vendor/ffmpeg");
