import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const metadataPath = path.join(
  projectRoot,
  "src",
  "metadata",
  "serviceCards.json",
);
const outputPath = path.join(projectRoot, "public", "llms.txt");

const siteUrl = (process.env.SITE_URL || "https://torensa.com").replace(
  /\/+$/,
  "",
);

const categoryOrder = [
  "business",
  "communication",
  "utilities",
  "developer",
];

const categoryLabels = {
  business: "Business Tools",
  communication: "Communication Tools",
  utilities: "Image Tools",
  developer: "Developer Tools",
};

// Some utilities are better grouped under more specific headings.
// Cards whose id starts with "image" or whose categoryId is "utilities" but are
// document/PDF/data/media oriented get a different heading.
const utilitiesSubgroups = [
  {
    label: "Image Tools",
    test: (card) =>
      card.id.startsWith("image-") || card.id === "image-generator",
  },
  {
    label: "PDF & Document Tools",
    test: (card) =>
      /pdf|word|excel/.test(card.id) || /pdf|word|excel|doc/.test((card.keywords || []).join(" ")),
  },
  {
    label: "Data & Media Tools",
    test: (card) => true, // catch-all for remaining utilities
  },
];

function normalizePath(routePath) {
  if (!routePath || typeof routePath !== "string") return null;
  const trimmed = routePath.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildCardEntry(card) {
  const route = normalizePath(card.path);
  if (!route) return null;

  const lines = [];
  lines.push(`### ${card.title}`);

  // Build concise bullet points from detailedDescription
  const desc = card.detailedDescription || card.description;
  // Split into sentences and use as bullets
  const sentences = desc
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Group into 2-3 bullets max for conciseness
  if (sentences.length <= 3) {
    for (const s of sentences) {
      lines.push(`- ${s}`);
    }
  } else {
    // First bullet: first 1-2 sentences (core description)
    lines.push(`- ${sentences.slice(0, 2).join(" ")}`);
    // Remaining key details
    for (const s of sentences.slice(2)) {
      lines.push(`- ${s}`);
    }
  }

  // Offline note
  if (card.offlineEnabled) {
    // Check if any bullet already mentions offline
    const alreadyMentioned = lines.some((l) => /offline/i.test(l));
    if (!alreadyMentioned) {
      lines.push("- Works fully offline once loaded.");
    }
  }

  // Auth note
  if (card.authRequired) {
    lines.push("- Requires login.");
  }

  // AI note
  if (card.aiPowered) {
    const alreadyMentioned = lines.some((l) => /\bAI\b/.test(l));
    if (!alreadyMentioned) {
      lines.push("- AI-powered.");
    }
  }

  lines.push(`- [${card.ctaLabel}](${siteUrl}${route})`);

  return lines.join("\n");
}

function buildLlmsTxt(cards) {
  const lines = [];

  lines.push("# Torensa: Free Video, PDF & Image Tools Online, No Signup Needed");
  lines.push("");
  lines.push(
    "> A comprehensive collection of free, browser-based tools for productivity, image processing, document conversion, file sharing, and developer workflows.",
  );
  lines.push("");
  lines.push(
    "Torensa provides free online tools designed to enhance work efficiency, streamline file and image management, and facilitate quick digital sharing. Most tools run entirely in the browser \u2014 no file uploads to external servers, no login required, instant results.",
  );
  lines.push("");

  // Group cards by category
  const cardsByCategory = new Map();
  for (const card of cards) {
    const cat = card.categoryId || "utilities";
    if (!cardsByCategory.has(cat)) cardsByCategory.set(cat, []);
    cardsByCategory.get(cat).push(card);
  }

  for (const catId of categoryOrder) {
    const catCards = cardsByCategory.get(catId);
    if (!catCards || catCards.length === 0) continue;

    // Utilities get split into subgroups
    if (catId === "utilities") {
      const remaining = [...catCards];
      for (const subgroup of utilitiesSubgroups) {
        const matched = remaining.filter(subgroup.test);
        if (matched.length === 0) continue;
        // Remove matched from remaining
        for (const m of matched) {
          const idx = remaining.indexOf(m);
          if (idx !== -1) remaining.splice(idx, 1);
        }
        lines.push(`## ${subgroup.label}`);
        lines.push("");
        for (const card of matched) {
          const entry = buildCardEntry(card);
          if (entry) {
            lines.push(entry);
            lines.push("");
          }
        }
      }
    } else {
      lines.push(`## ${categoryLabels[catId] || catId}`);
      lines.push("");
      for (const card of catCards) {
        const entry = buildCardEntry(card);
        if (entry) {
          lines.push(entry);
          lines.push("");
        }
      }
    }
  }

  // Handle any categories not in categoryOrder
  for (const [catId, catCards] of cardsByCategory) {
    if (categoryOrder.includes(catId)) continue;
    if (catCards.length === 0) continue;
    lines.push(`## ${categoryLabels[catId] || catId}`);
    lines.push("");
    for (const card of catCards) {
      const entry = buildCardEntry(card);
      if (entry) {
        lines.push(entry);
        lines.push("");
      }
    }
  }

  lines.push("## Resources");
  lines.push("");
  lines.push(`- [All Tools](${siteUrl})`);
  lines.push(`- [Sitemap](${siteUrl}/sitemap.xml)`);
  lines.push(`- [Privacy Policy](${siteUrl}/privacy)`);
  lines.push(`- [Terms of Service](${siteUrl}/terms)`);
  lines.push("");

  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- Most tools process data entirely client-side in the browser \u2014 no files are sent to external servers.",
  );
  lines.push(
    "- Tools that require a server (document conversion, AI features, background removal, speech-to-text) process files in memory and do not store them.",
  );
  lines.push("- New tools are added continuously.");

  // Check if any card requires auth
  const authCards = cards.filter((c) => c.authRequired);
  if (authCards.length > 0) {
    const names = authCards.map((c) => c.title).join(", ");
    lines.push(
      `- Most tools require no account or login. ${names} ${authCards.length === 1 ? "requires" : "require"} login.`,
    );
  }

  lines.push("");

  return lines.join("\n");
}

async function main() {
  const metadataRaw = await readFile(metadataPath, "utf-8").then((s) =>
    s.replace(/^\uFEFF/, ""),
  );
  const metadata = JSON.parse(metadataRaw);

  if (!Array.isArray(metadata)) {
    throw new Error("serviceCards.json must be an array");
  }

  const activeCards = metadata.filter(
    (card) =>
      card &&
      typeof card === "object" &&
      card.isActive !== false &&
      normalizePath(card.path),
  );

  const content = buildLlmsTxt(activeCards);

  await writeFile(outputPath, content, "utf-8");
  console.log(
    `Generated llms.txt with ${activeCards.length} tools at ${outputPath}`,
  );
}

main().catch((error) => {
  console.error("Failed to generate llms.txt:", error);
  process.exit(1);
});
