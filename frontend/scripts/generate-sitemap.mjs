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
const publicDir = path.join(projectRoot, "public");
const pagesDir = path.join(projectRoot, "src", "pages");
const execFileAsync = promisify(execFile);

let shallowRepoCache = null;
let warnedShallowRepo = false;

const siteUrl = (process.env.SITE_URL || "https://torensa.com").replace(
  /\/+$/,
  "",
);

// ── Language configuration ──────────────────────────────────────────
// To add a new language, append an entry here and create the
// corresponding serviceCards.<code>.json + ui.<code>.json metadata.
const LANGUAGES = [
  { code: "en", isDefault: true },
  { code: "de", isDefault: false },
  { code: "nl", isDefault: false },
];
const DEFAULT_LANG = LANGUAGES.find((l) => l.isDefault) ?? LANGUAGES[0];

const staticRouteComponents = {
  "/": "Home",
  "/about": "Contact",
  "/privacy": "PrivacyPolicy",
  "/terms": "TermsOfService",
};

// ── XML helpers ─────────────────────────────────────────────────────

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

function routeUrl(route, lang) {
  const prefix = lang.isDefault ? "" : `/${lang.code}`;
  const fullPath = route === "/" ? prefix || "/" : `${prefix}${route}`;
  return new URL(fullPath, `${siteUrl}/`).toString();
}

// ── Sitemap XML builders ────────────────────────────────────────────

function buildLanguageSitemapXml(routes, lang, lastmodMap) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];

  for (const route of routes) {
    const loc = routeUrl(route, lang);
    const lastmod = lastmodMap.get(route);

    lines.push("  <url>");
    lines.push(`    <loc>${xmlEscape(loc)}</loc>`);
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);

    // hreflang alternates pointing to every language variant
    for (const altLang of LANGUAGES) {
      const href = routeUrl(route, altLang);
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${altLang.code}" href="${xmlEscape(href)}"/>`,
      );
    }
    // x-default points to the default language
    const defaultHref = routeUrl(route, DEFAULT_LANG);
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(defaultHref)}"/>`,
    );

    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}

function buildSitemapIndexXml() {
  const now = new Date().toISOString();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const lang of LANGUAGES) {
    const loc = `${siteUrl}/sitemap-${lang.code}.xml`;
    lines.push("  <sitemap>");
    lines.push(`    <loc>${xmlEscape(loc)}</loc>`);
    lines.push(`    <lastmod>${now}</lastmod>`);
    lines.push("  </sitemap>");
  }

  lines.push("</sitemapindex>");
  return `${lines.join("\n")}\n`;
}

// ── Date resolution helpers ─────────────────────────────────────────

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toRepoRelativePath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
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

async function readExistingSitemapDates() {
  const dates = new Map();

  // Read dates from all existing per-language sitemaps and the legacy single sitemap
  const filesToCheck = [
    path.join(publicDir, "sitemap.xml"),
    ...LANGUAGES.map((l) => path.join(publicDir, `sitemap-${l.code}.xml`)),
  ];

  for (const filePath of filesToCheck) {
    try {
      const xml = await readFile(filePath, "utf-8");
      const urlBlockRegex =
        /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g;
      let match;
      while ((match = urlBlockRegex.exec(xml)) !== null) {
        const loc = match[1].trim();
        const lastmod = match[2].trim();
        try {
          const url = new URL(loc);
          const pathname =
            url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
          // Strip language prefix to get the canonical route
          const stripped = stripLangPrefix(pathname);
          if (!dates.has(stripped)) dates.set(stripped, lastmod);
        } catch {
          dates.set(loc, lastmod);
        }
      }
    } catch {
      // File doesn't exist yet — skip.
    }
  }

  return dates;
}

function stripLangPrefix(pathname) {
  for (const lang of LANGUAGES) {
    if (lang.isDefault) continue;
    const prefix = `/${lang.code}`;
    if (pathname === prefix) return "/";
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return pathname;
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

// ── Main ────────────────────────────────────────────────────────────

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

  // Resolve lastmod once per canonical route (shared across languages)
  const lastmodMap = new Map();
  await Promise.all(
    sortedRoutes.map(async (route) => {
      const lastmod = await resolveLastmod(
        route,
        routeToComponent.get(route),
        fallbackLastmod,
        existingDates,
      );
      lastmodMap.set(route, lastmod);
    }),
  );

  // Generate per-language sitemaps
  const writes = [];
  for (const lang of LANGUAGES) {
    const xml = buildLanguageSitemapXml(sortedRoutes, lang, lastmodMap);
    const filePath = path.join(publicDir, `sitemap-${lang.code}.xml`);
    writes.push(writeFile(filePath, xml, "utf-8"));
    console.log(
      `Generated sitemap-${lang.code}.xml with ${sortedRoutes.length} URLs`,
    );
  }

  // Generate sitemap index
  const indexXml = buildSitemapIndexXml();
  writes.push(
    writeFile(path.join(publicDir, "sitemap.xml"), indexXml, "utf-8"),
  );
  console.log(
    `Generated sitemap.xml index referencing ${LANGUAGES.length} language sitemaps`,
  );

  await Promise.all(writes);
}

main().catch((error) => {
  console.error("Failed to generate sitemap:", error);
  process.exit(1);
});
