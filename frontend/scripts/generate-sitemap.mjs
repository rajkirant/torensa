import { readFile, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const metadataPath = path.join(
  projectRoot,
  "src",
  "metadata",
  "serviceCards.json",
);
const sitemapPath = path.join(projectRoot, "public", "sitemap.xml");
const pagesDir = path.join(projectRoot, "src", "pages");
const execFileAsync = promisify(execFile);

let shallowRepoCache = null;
let warnedShallowRepo = false;

const siteUrl = (process.env.SITE_URL || "https://torensa.com").replace(
  /\/+$/,
  "",
);
const staticRouteComponents = {
  "/": "Home",
  "/about": "Contact",
  "/privacy": "PrivacyPolicy",
  "/terms": "TermsOfService",
  "/login": "Login",
  "/signup": "Signup",
};

function xmlEscape(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizePath(routePath) {
  if (!routePath || typeof routePath !== "string") return null;
  const trimmed = routePath.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function withLangPrefix(route, lang) {
  if (!route || route === "/") return `/${lang}`;
  return `/${lang}${route}`;
}

function buildSitemapXml(routeEntries) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9',
    '                            http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
  ];

  for (const entry of routeEntries) {
    const loc = new URL(entry.route, `${siteUrl}/`).toString();
    lines.push("  <url>");
    lines.push(`    <loc>${xmlEscape(loc)}</loc>`);
    lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toRepoRelativePath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

async function getGitLastmodForFile(filePath) {
  if (await isShallowRepo()) {
    if (!warnedShallowRepo) {
      console.warn(
        "Git history is shallow; skipping per-file git lastmod. Consider fetching full history to preserve accurate lastmod dates.",
      );
      warnedShallowRepo = true;
    }
    return null;
  }

  try {
    const relativePath = toRepoRelativePath(filePath);
    const { stdout } = await execFileAsync(
      "git",
      ["-C", projectRoot, "log", "-1", "--format=%cs", "--", relativePath],
      { timeout: 10000 },
    );
    const date = stdout.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch {
    // Fall back to filesystem mtime when git is unavailable or path is untracked.
  }
  return null;
}

async function isShallowRepo() {
  if (shallowRepoCache !== null) return shallowRepoCache;
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", projectRoot, "rev-parse", "--is-shallow-repository"],
      { timeout: 10000 },
    );
    shallowRepoCache = stdout.trim() === "true";
  } catch {
    shallowRepoCache = false;
  }
  return shallowRepoCache;
}

async function readExistingSitemapDates() {
  try {
    const xml = await readFile(sitemapPath, "utf-8");
    const dates = new Map();
    const urlBlockRegex =
      /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g;
    let match;
    while ((match = urlBlockRegex.exec(xml)) !== null) {
      const loc = match[1].trim();
      const lastmod = match[2].trim();
      // Store by path (strip site origin)
      try {
        const url = new URL(loc);
        dates.set(
          url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, ""),
          lastmod,
        );
      } catch {
        dates.set(loc, lastmod);
      }
    }
    return dates;
  } catch {
    return new Map();
  }
}

async function getPreferredLastmodForFile(filePath, existingDate) {
  const gitLastmod = await getGitLastmodForFile(filePath);
  if (gitLastmod) return gitLastmod;

  // Prefer the preserved date from the existing sitemap over unreliable filesystem mtime.
  // On Windows, mtime is often set to today on checkout, which would incorrectly
  // mark every URL as modified today.
  if (existingDate) return existingDate;

  const fileStat = await stat(filePath);
  return toDateString(fileStat.mtime);
}

function getComponentCandidates(component) {
  if (!component || typeof component !== "string") return [];
  const trimmed = component.trim();
  if (!trimmed) return [];

  const withExtension = /\.[a-z0-9]+$/i.test(trimmed);
  if (withExtension) {
    return [path.join(pagesDir, trimmed)];
  }

  return [
    path.join(pagesDir, `${trimmed}.tsx`),
    path.join(pagesDir, `${trimmed}.ts`),
    path.join(pagesDir, `${trimmed}.jsx`),
    path.join(pagesDir, `${trimmed}.js`),
    path.join(pagesDir, trimmed, "index.tsx"),
    path.join(pagesDir, trimmed, "index.ts"),
    path.join(pagesDir, trimmed, "index.jsx"),
    path.join(pagesDir, trimmed, "index.js"),
  ];
}

async function resolveLastmod(
  route,
  component,
  fallbackLastmod,
  existingDates,
) {
  const existingDate = existingDates.get(route);
  for (const candidate of getComponentCandidates(component)) {
    try {
      return await getPreferredLastmodForFile(candidate, existingDate);
    } catch {
      // Keep trying candidates until one exists.
    }
  }

  if (component) {
    console.warn(
      `Unable to resolve component file for route "${route}" from component "${component}". Falling back to metadata date.`,
    );
  } else {
    console.warn(
      `No component mapped for route "${route}". Falling back to metadata date.`,
    );
  }

  return existingDate ?? fallbackLastmod;
}

async function main() {
  const [metadataRaw, existingDates] = await Promise.all([
    readFile(metadataPath, "utf-8").then((s) => s.replace(/^\uFEFF/, "")),
    readExistingSitemapDates(),
  ]);
  const metadata = JSON.parse(metadataRaw);
  const routeToComponent = new Map(Object.entries(staticRouteComponents));

  if (Array.isArray(metadata)) {
    for (const item of metadata) {
      if (!item || typeof item !== "object") continue;
      if (item.authRequired === true) continue;
      if (item.isActive === false) continue;

      const normalized = normalizePath(item.path);
      if (normalized) routeToComponent.set(normalized, item.component);
    }
  }

  const sortedRoutes = [...routeToComponent.keys()].sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });

  const fallbackLastmod = await getPreferredLastmodForFile(
    metadataPath,
    existingDates.get("/"),
  );

  const routeEntries = await Promise.all(
    sortedRoutes.flatMap((route) => [
      {
        route,
        lang: "en",
      },
      {
        route: withLangPrefix(route, "de"),
        lang: "de",
      },
    ]).map(async ({ route }) => ({
      route,
      lastmod: await resolveLastmod(
        route,
        routeToComponent.get(route === "/de" ? "/" : route.replace(/^\/de/, "")),
        fallbackLastmod,
        existingDates,
      ),
    })),
  );

  const xml = buildSitemapXml(routeEntries);

  await writeFile(sitemapPath, xml, "utf-8");
  console.log(
    `Generated sitemap with ${routeEntries.length} URLs at ${sitemapPath}`,
  );
}

main().catch((error) => {
  console.error("Failed to generate sitemap:", error);
  process.exit(1);
});
