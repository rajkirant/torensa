import React from "react";
import { useNavigate, useOutletContext, useLocation } from "react-router-dom";
import type { CSSProperties } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import WifiOffOutlinedIcon from "@mui/icons-material/WifiOffOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";

import { PrimaryButton } from "../components/buttons/PrimaryButton";
import serviceCards from "../metadata/serviceCards.json";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import type { AppOutletContext } from "../App";
import {
  searchBarSx,
  searchBarIconSx,
  searchBarClearIconSx,
  heroBannerStyle,
  heroHeadlineStyle,
  heroGradientTextStyle,
  heroSubtitleStyle,
  heroPillarsRowStyle,
  heroPillarItemStyle,
  heroIconColor,
  seoTextBlockStyle,
} from "../styles/appStyles";
import {
  type ServiceCardConfig,
  getActiveServiceCards,
  getOfflineServiceCards,
  getServiceCardsByCategory,
} from "../utils/serviceCards";
import { toolIcons } from "../metadata/toolIcons";

const ADSENSE_CLIENT_ID =
  import.meta.env.VITE_ADSENSE_CLIENT || "ca-pub-7466905660040122";
const ADSENSE_SCRIPT_ID = "adsense-script";

function ensureAdSenseScript() {
  if (document.getElementById(ADSENSE_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

/* ===================== DATA (JSON) ===================== */
const typedServiceCards = (serviceCards as ServiceCardConfig[]) ?? [];
const INITIAL_VISIBLE_CARDS = 9;
const LOAD_MORE_STEP = 6;

/* ===================== HERO BANNER ===================== */
function HeroBanner({
  isMobile,
  toolCount,
}: {
  isMobile: boolean;
  toolCount: number;
}) {
  const theme = useTheme();
  const iconSx = { fontSize: 16, color: heroIconColor(theme) };

  return (
    <header style={heroBannerStyle}>
      <h1 style={heroHeadlineStyle(isMobile)}>
        Free Online Tools,{" "}
        <span style={heroGradientTextStyle(theme)}>Zero Nonsense</span>
      </h1>

      <div style={heroPillarsRowStyle(isMobile, theme)}>
        <span style={heroPillarItemStyle}>
          <ShieldOutlinedIcon sx={iconSx} />
          Privacy-first
        </span>
        <span style={heroPillarItemStyle}>
          <WifiOffOutlinedIcon sx={iconSx} />
          Works offline
        </span>
        <span style={heroPillarItemStyle}>
          <CodeOutlinedIcon sx={iconSx} />
          Open source
        </span>
        <span style={heroPillarItemStyle}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 16,
              color: heroIconColor(theme),
              marginRight: 6,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ marginRight: 2 }}
            >
              <circle
                cx="10"
                cy="10"
                r="8"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M10 4v4m0 4v4m4-4h-4m-4 0h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          AI-powered
        </span>
      </div>
    </header>
  );
}

/* ===================== COMPONENT ===================== */
export default function Home() {
  const {
    secondaryTextColor,
    sectionBase,
    cardStyle,
    selectedCategoryId,
    selectedCategoryLabel,
  } = useOutletContext<AppOutletContext>();

  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isOnline = useOnlineStatus();
  const isMobile = useMediaQuery("(max-width:700px)");
  const isTablet = useMediaQuery("(max-width:1050px)");
  const columns = isMobile ? 1 : isTablet ? 2 : 3;
  const outlinedBorderColor =
    theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.23)"
      : "rgba(0,0,0,0.23)";

  const secondaryText: CSSProperties = {
    color: secondaryTextColor,
  };
  const cardsGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(260px, 320px))`,
    justifyContent: "center",
    gap: 28,
  };
  const cardsMaxWidth = columns * 320 + (columns - 1) * 28;
  const loadMoreWrapperStyle: CSSProperties = {
    width: `min(100%, ${cardsMaxWidth}px)`,
    margin: "18px auto 0",
  };
  const searchWrapperStyle: CSSProperties = {
    width: `min(100%, ${cardsMaxWidth}px)`,
    margin: "0 auto 24px",
  };
  const loadMoreButtonStyle: CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: `1px solid ${outlinedBorderColor}`,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    color: secondaryTextColor,
    fontSize: 14,
    fontWeight: 600,
    textTransform: "none",
  };

  // Safety guard (never crash)
  const allCards = Array.isArray(typedServiceCards)
    ? getActiveServiceCards(typedServiceCards)
    : [];
  const [searchTerm, setSearchTerm] = React.useState("");
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const cards = getServiceCardsByCategory(allCards, selectedCategoryId);
  const offlineCards = getOfflineServiceCards(cards);
  const matchesSearch = (card: ServiceCardConfig) => {
    if (!normalizedSearchTerm) return true;
    const keywordText = (card.keywords ?? []).join(" ");
    const searchableText =
      `${card.title} ${card.description} ${card.ctaLabel} ${keywordText}`.toLowerCase();
    return searchableText.includes(normalizedSearchTerm);
  };
  const filteredCards = cards.filter((card) => {
    return matchesSearch(card);
  });
  const filteredOfflineCards = offlineCards.filter((card) => {
    return matchesSearch(card);
  });
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_VISIBLE_CARDS);
  const visibleCards = filteredCards.slice(0, visibleCount);
  const visibleOfflineCards = filteredOfflineCards.slice(0, visibleCount);
  const canLoadMoreCards = visibleCount < filteredCards.length;
  const canLoadMoreOfflineCards = visibleCount < filteredOfflineCards.length;

  const showHero = selectedCategoryId === "all" && !normalizedSearchTerm;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + LOAD_MORE_STEP);
  };

  React.useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_CARDS);
  }, [selectedCategoryId, isOnline, searchTerm]);

  React.useEffect(() => {
    ensureAdSenseScript();
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (selectedCategoryId === "all") {
      params.delete("categories");
    } else {
      params.set("categories", selectedCategoryId);
    }

    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith("?")
      ? location.search.slice(1)
      : location.search;

    if (nextSearch !== currentSearch) {
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true },
      );
    }
  }, [selectedCategoryId, location.pathname, location.search, navigate]);

  const searchInput = (
    <div style={searchWrapperStyle}>
      <TextField
        fullWidth
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search tools by name, description, or keyword"
        aria-label="Search tools"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon sx={searchBarIconSx(theme)} />
            </InputAdornment>
          ),
          endAdornment: searchTerm ? (
            <InputAdornment position="end">
              <IconButton
                aria-label="Clear search"
                size="small"
                onClick={() => setSearchTerm("")}
              >
                <CloseRoundedIcon
                  sx={searchBarClearIconSx(theme)}
                  fontSize="small"
                />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        }}
        sx={searchBarSx(theme)}
      />
    </div>
  );

  const toolsSectionTitle: CSSProperties = {
    textAlign: "center",
    margin: "0 0 20px",
    fontSize: showHero ? 28 : undefined,
    fontWeight: showHero ? 700 : undefined,
  };

  // OFFLINE: show message + only offlineEnabled tools
  if (!isOnline) {
    return (
      <section style={sectionBase}>
        <h1 style={{ textAlign: "center", marginBottom: 16 }}>
          Limited offline mode
        </h1>

        <p
          style={{
            ...secondaryText,
            textAlign: "center",
            maxWidth: 480,
            margin: "0 auto 32px",
          }}
        >
          You&apos;re offline. Only tools that support offline usage are
          available right now.
        </p>

        {searchInput}

        <div style={cardsGridStyle}>
          {visibleOfflineCards.map((card) => {
            const Icon = toolIcons[card.id];
            return (
              <div
                key={card.id}
                className="card-hover"
                style={cardStyle}
                onClick={() => navigate(card.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") navigate(card.path);
                }}
              >
                {Icon && <Icon sx={{ mb: 1, fontSize: 32 }} />}
                <h3>{card.title}</h3>
                <p style={secondaryText}>{card.description}</p>
                <PrimaryButton size="small">{card.ctaLabel}</PrimaryButton>
              </div>
            );
          })}

          {filteredOfflineCards.length === 0 && (
            <p
              style={{
                ...secondaryText,
                textAlign: "center",
                gridColumn: "1 / -1",
              }}
            >
              {normalizedSearchTerm
                ? "No offline tools match your search."
                : "No tools are available offline yet."}
            </p>
          )}
        </div>

        {canLoadMoreOfflineCards && (
          <div style={loadMoreWrapperStyle}>
            <Button
              type="button"
              style={loadMoreButtonStyle}
              onClick={handleLoadMore}
              endIcon={<KeyboardArrowDownRoundedIcon />}
            >
              Load more
            </Button>
          </div>
        )}
      </section>
    );
  }

  // ONLINE: show hero + all services
  return (
    <section style={sectionBase}>
      {showHero && (
        <HeroBanner isMobile={isMobile} toolCount={allCards.length} />
      )}

      <div>
        {!showHero && (
          <h2 style={toolsSectionTitle}>{selectedCategoryLabel}</h2>
        )}

        {showHero && (
          <div
            style={{
              ...searchWrapperStyle,
              ...seoTextBlockStyle(isMobile, secondaryTextColor),
            }}
          >
            <p style={{ margin: 0 }}>
              Torensa is a growing collection of free online tools built to make
              everyday work faster, safer, and more reliable without forcing you
              to create an account or pay a fee. The platform brings together
              practical utilities for writing, converting, calculating,
              formatting, organizing, and researching, with a focus on clean
              interfaces that let you get in, get a result, and get back to your
              task. Many tools are designed for developers, such as code
              formatters, validators, and data utilities, while others are made
              for anyone who needs quick answers, better productivity, or
              privacy friendly workflows. The goal is to remove friction and
              replace it with clarity: open a tool, drop in your input, and see
              the output instantly.
              <br />
              <br />
              A major emphasis is privacy and control. Torensa avoids tracking
              heavy analytics and keeps the experience lightweight, so you can
              use tools without feeling watched or profiled. Many features are
              offline capable, which means a tool can keep working even when
              your connection is unstable or when you prefer to stay offline.
              This matters for travel, secure environments, or anyone who just
              wants consistent performance. When a tool uses AI assistance, the
              behavior is made clear in the interface and the results are
              designed to be helpful without locking you into a paid tier.
              <br />
              <br />
              Torensa is also fully open source on GitHub, which means the code
              is visible, auditable, and ready for contributions. You can review
              how a tool works, suggest improvements, or build your own
              self-hosted version for your team. This transparency builds trust
              and lets the community shape the roadmap. Whether you are a
              student, a builder, a small business, or just someone who values
              privacy and simplicity, Torensa offers a dependable set of
              resources that keep your data in your hands and your workflow
              moving forward.
            </p>
          </div>
        )}

        {searchInput}

        <div style={cardsGridStyle}>
          {visibleCards.map((card) => {
            const Icon = toolIcons[card.id];
            return (
              <div
                key={card.id}
                className="card-hover"
                style={cardStyle}
                onClick={() => navigate(card.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") navigate(card.path);
                }}
              >
                {Icon && <Icon sx={{ mb: 1, fontSize: 32 }} />}
                <h3>{card.title}</h3>
                <p style={secondaryText}>{card.description}</p>
                <PrimaryButton size="small">{card.ctaLabel}</PrimaryButton>
              </div>
            );
          })}

          {filteredCards.length === 0 && (
            <p
              style={{
                ...secondaryText,
                textAlign: "center",
                gridColumn: "1 / -1",
              }}
            >
              {normalizedSearchTerm ? (
                "No tools match your search in this category."
              ) : (
                <>
                  No services found. Add entries to{" "}
                  <code>metadata/serviceCards.json</code>.
                </>
              )}
            </p>
          )}
        </div>

        {canLoadMoreCards && (
          <div style={loadMoreWrapperStyle}>
            <Button
              type="button"
              style={loadMoreButtonStyle}
              onClick={handleLoadMore}
              endIcon={<KeyboardArrowDownRoundedIcon />}
            >
              Load more
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
