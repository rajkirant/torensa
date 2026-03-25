import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const distDir = resolve(process.cwd(), "dist");

const staticRoutes = ["/", "/about", "/contact", "/privacy", "/terms"];

const serviceCardsPath = resolve(
  process.cwd(),
  "src/metadata/serviceCards.json",
);
const serviceCards = JSON.parse(
  await readFile(serviceCardsPath, "utf-8"),
);

const toolRoutes = serviceCards
  .filter((card) => card && card.isActive !== false)
  .filter((card) => !card.authRequired)
  .map((card) => card.path)
  .filter((path) => typeof path === "string" && path.startsWith("/"));

const routes = Array.from(new Set([...staticRoutes, ...toolRoutes]));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function getContentType(filePath) {
  return contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = decodeURIComponent(url.pathname);
      const hasExtension = extname(pathname) !== "";
      const candidatePath = join(distDir, pathname);

      if (hasExtension && (await fileExists(candidatePath))) {
        const data = await readFile(candidatePath);
        res.writeHead(200, { "Content-Type": getContentType(candidatePath) });
        res.end(data);
        return;
      }

      const indexPath = join(distDir, "index.html");
      const data = await readFile(indexPath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Server error");
    }
  });

  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to start prerender server.");
      }
      resolveServer({ server, port: address.port });
    });
  });
}

async function waitForSeoTags(page) {
  try {
    await page.waitForFunction(
      () => {
        const canonical = document.querySelector('link[rel="canonical"]');
        const description = document.querySelector('meta[name="description"]');
        const hasDescription = !!(description && description.getAttribute("content"));
        const hasCanonical = !!(canonical && canonical.getAttribute("href"));
        // If Helmet runs, we should get both; otherwise at least keep description.
        return hasDescription && (hasCanonical || document.location.pathname === "/");
      },
      { timeout: 60000 },
    );
  } catch {
    // Do not fail the build if SEO tags are slow to hydrate.
  }
}

async function renderRoute(page, baseUrl, route) {
  const url = `${baseUrl}${route}`;
  await page.goto(url, { waitUntil: "networkidle0" });
  await waitForSeoTags(page);
  return await page.content();
}

function routeToFilePath(route) {
  if (route === "/") {
    return join(distDir, "index.html");
  }
  const dir = join(distDir, route.replace(/^\/+/, ""));
  return join(dir, "index.html");
}

async function writeRouteHtml(route, html) {
  const outputPath = routeToFilePath(route);
  const dir = outputPath.replace(/[/\\]index\.html$/, "");
  await mkdir(dir, { recursive: true });
  await writeFile(outputPath, html, "utf-8");
}

function resolveExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN;
  }
  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

const { server, port } = await startStaticServer();
const baseUrl = `http://127.0.0.1:${port}`;

const executablePath = resolveExecutablePath();
const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  ...(executablePath ? { executablePath } : {}),
});

try {
  const page = await browser.newPage();
  for (const route of routes) {
    const html = await renderRoute(page, baseUrl, route);
    await writeRouteHtml(route, html);
  }
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log(`Prerendered ${routes.length} routes.`);
