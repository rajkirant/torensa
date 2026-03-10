import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import serviceCards from "../metadata/serviceCards.json";
import {
  type ServiceCardConfig,
  getActiveServiceCards,
} from "../utils/serviceCards";

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
  "/about": {
    title: "About Us | Torensa",
    description:
      "Learn about Torensa, our mission to build open-source productivity tools, and how to get in touch.",
  },
  "/contact": {
    title: "About Us | Torensa",
    description:
      "Learn about Torensa, our mission to build open-source productivity tools, and how to get in touch.",
  },
  "/privacy": {
    title: "Privacy Policy | Torensa",
    description:
      "Learn how Torensa collects, uses, and protects your information. Covers cookies, analytics, advertising, and your data rights.",
  },
  "/terms": {
    title: "Terms of Service | Torensa",
    description:
      "Read the Terms of Service for using Torensa tools, including acceptable use, intellectual property, and liability.",
  },
  "/login": {
    title: "Login | Torensa",
    description: "Sign in to your Torensa account to access protected tools.",
  },
  "/signup": {
    title: "Sign Up | Torensa",
    description:
      "Create your Torensa account to get started with available tools.",
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
    for (const card of getActiveServiceCards(
      serviceCards as ServiceCardConfig[],
    )) {
      map.set(normalizePath(card.path), {
        title: formatToolTitle(card.title),
        description: card.description,
      });
    }
    return map;
  }, []);

  const meta = toolMetaByPath.get(normalizedPath) ??
    STATIC_ROUTE_META[normalizedPath] ?? {
      title: "Page Not Found | Torensa",
      description:
        "The requested page could not be found. Explore Torensa tools from the homepage.",
    };

  const canonical =
    normalizedPath === "/" ? SITE_URL : `${SITE_URL}${normalizedPath}`;

  const isHome = normalizedPath === "/";
  const isTool = toolMetaByPath.has(normalizedPath);

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Torensa",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    contactPoint: {
      "@type": "ContactPoint",
      email: "admin@torensa.com",
      contactType: "customer support",
    },
    sameAs: [
      "https://github.com/rajkirant/torensa",
      "https://www.facebook.com/tryTorensa",
    ],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Torensa",
    url: SITE_URL,
    description: DEFAULT_META.description,
  };

  const toolSchema = isTool
    ? {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: meta.title.replace(" | Torensa", ""),
        url: canonical,
        description: meta.description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "All",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      }
    : null;

  const breadcrumbSchema =
    normalizedPath !== "/"
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: SITE_URL,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: meta.title.replace(" | Torensa", ""),
              item: canonical,
            },
          ],
        }
      : null;

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonical} />
      {isHome && (
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
      )}
      {isHome && (
        <script type="application/ld+json">
          {JSON.stringify(websiteSchema)}
        </script>
      )}
      {toolSchema && (
        <script type="application/ld+json">{JSON.stringify(toolSchema)}</script>
      )}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
    </Helmet>
  );
}
