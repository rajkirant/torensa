import React, { useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  useLanguage,
  useServiceCards,
  stripLanguagePrefix,
  withLanguagePrefix,
} from "../utils/language";
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
    "Torensa offers free online productivity tools: QR code generator, barcode tools, image compressor, file converters, PDF merger, PDF splitter, crop and more.",
};

const STATIC_ROUTE_META: Record<string, RouteMeta> = {
  "/": DEFAULT_META,
  "/about": {
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

declare function gtag(...args: unknown[]): void;

export default function SeoManager() {
  const location = useLocation();
  const normalizedPath = normalizePath(location.pathname);
  const strippedPath = normalizePath(stripLanguagePrefix(location.pathname));
  const { language } = useLanguage();
  const serviceCards = useServiceCards();

  useEffect(() => {
    if (typeof gtag !== "undefined") {
      gtag("event", "page_view", {
        page_path: location.pathname,
        page_search: location.search,
      });
    }
  }, [location.pathname, location.search]);

  const activeCards = useMemo(
    () => getActiveServiceCards(serviceCards as ServiceCardConfig[]),
    [serviceCards],
  );

  const toolMetaByPath = useMemo(() => {
    const map = new Map<string, RouteMeta>();
    for (const card of activeCards) {
      map.set(normalizePath(card.path), {
        title: formatToolTitle(card.title),
        description: card.description,
      });
    }
    return map;
  }, [activeCards]);

  const meta = toolMetaByPath.get(strippedPath) ??
    STATIC_ROUTE_META[strippedPath] ?? {
      title: "Page Not Found | Torensa",
      description:
        "The requested page could not be found. Explore Torensa tools from the homepage.",
    };

  const canonicalPath =
    language === "de"
      ? withLanguagePrefix(strippedPath, "de")
      : stripLanguagePrefix(normalizedPath);
  const canonical =
    canonicalPath === "/" ? SITE_URL : `${SITE_URL}${canonicalPath}`;

  const isHome = strippedPath === "/";
  const isTool = toolMetaByPath.has(strippedPath);
  const currentTool = isTool
    ? activeCards.find(
        (card) => normalizePath(card.path) === strippedPath,
      )
    : null;

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
        name: currentTool?.name ?? meta.title.replace(" | Torensa", ""),
        url: canonical,
        description: meta.description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "All",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      }
    : null;

  const faqSchema =
    currentTool?.faqs && currentTool.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: currentTool.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.a,
            },
          })),
        }
      : null;

  const breadcrumbSchema =
    strippedPath !== "/"
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
              name: currentTool?.name ?? meta.title.replace(" | Torensa", ""),
              item: canonical,
            },
          ],
        }
      : null;

  return (
    <Helmet>
      <html lang={language} />
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
      {faqSchema && (
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      )}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
    </Helmet>
  );
}
