import { readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const metadataPath = path.join(projectRoot, "src", "metadata", "serviceCards.json");
const sitemapPath = path.join(projectRoot, "public", "sitemap.xml");

const siteUrl = (process.env.SITE_URL || "https://torensa.com").replace(/\/+$/, "");
const staticRoutes = ["/", "/contact"];

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

function buildSitemapXml(routes, lastmod) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9',
    '                            http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
  ];

  for (const route of routes) {
    const loc = new URL(route, `${siteUrl}/`).toString();
    lines.push("  <url>");
    lines.push(`    <loc>${xmlEscape(loc)}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const metadataRaw = await readFile(metadataPath, "utf-8");
  const metadata = JSON.parse(metadataRaw);
  const routes = new Set(staticRoutes);

  if (Array.isArray(metadata)) {
    for (const item of metadata) {
      if (!item || typeof item !== "object") continue;
      if (item.authRequired === true) continue;

      const normalized = normalizePath(item.path);
      if (normalized) routes.add(normalized);
    }
  }

  const sortedRoutes = [...routes].sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });

  const metadataStat = await stat(metadataPath);
  const lastmod = metadataStat.mtime.toISOString().slice(0, 10);
  const xml = buildSitemapXml(sortedRoutes, lastmod);

  await writeFile(sitemapPath, xml, "utf-8");
  console.log(`Generated sitemap with ${sortedRoutes.length} URLs at ${sitemapPath}`);
}

main().catch((error) => {
  console.error("Failed to generate sitemap:", error);
  process.exit(1);
});
