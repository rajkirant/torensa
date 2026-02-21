import React, { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import serviceCards from "../metadata/serviceCards.json";

type ServiceCardMeta = {
  path: string;
  title: string;
  description: string;
  isActive?: boolean;
};

type RouteMeta = {
  title: string;
  description: string;
};

const SITE_URL = "https://torensa.com";
const DEFAULT_META: RouteMeta = {
  title: "Torensa | Smart Online Tools for Work & Productivity",
  description:
    "Torensa offers practical online tools including bulk email sending, text-to-QR, Excel to CSV conversion, and automation utilities built for productivity.",
};

const STATIC_ROUTE_META: Record<string, RouteMeta> = {
  "/": DEFAULT_META,
  "/contact": {
    title: "Contact | Torensa",
    description: "Get in touch with Torensa for support, feedback, or inquiries.",
  },
  "/login": {
    title: "Login | Torensa",
    description: "Sign in to your Torensa account to access protected tools.",
  },
  "/signup": {
    title: "Sign Up | Torensa",
    description: "Create your Torensa account to get started with available tools.",
  },
};

function normalizePath(pathname: string) {
  if (!pathname) return "/";
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function formatToolTitle(title: string) {
  return title.toLowerCase().includes("torensa") ? title : `${title} | Torensa`;
}

export default function SeoManager() {
  const location = useLocation();
  const normalizedPath = normalizePath(location.pathname);

  const toolMetaByPath = useMemo(() => {
    const map = new Map<string, RouteMeta>();
    for (const card of serviceCards as ServiceCardMeta[]) {
      if (card?.isActive === false) continue;
      map.set(normalizePath(card.path), {
        title: formatToolTitle(card.title),
        description: card.description,
      });
    }
    return map;
  }, []);

  const meta =
    toolMetaByPath.get(normalizedPath) ??
    STATIC_ROUTE_META[normalizedPath] ??
    {
      title: "Page Not Found | Torensa",
      description:
        "The requested page could not be found. Explore Torensa tools from the homepage.",
    };

  const canonical =
    normalizedPath === "/" ? SITE_URL : `${SITE_URL}${normalizedPath}`;

  useEffect(() => {
    document.title = meta.title;

    const descriptionEl = document.querySelector(
      'meta[name="description"]',
    ) as HTMLMetaElement | null;
    if (descriptionEl) {
      descriptionEl.content = meta.description;
    }

    const canonicalEl = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null;
    if (canonicalEl) {
      canonicalEl.href = canonical;
    }
  }, [meta.title, meta.description, canonical]);

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonical} />
    </Helmet>
  );
}
