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
import {
  useLanguage,
  usePageDescriptions,
  useServiceCards,
  withLanguagePrefix,
} from "../utils/language";
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
import { useTranslation } from "react-i18next";


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
  const { t } = useTranslation();
  const theme = useTheme();
  const iconSx = { fontSize: 16, color: heroIconColor(theme) };

  return (
    <header style={heroBannerStyle}>
      <h1 style={heroHeadlineStyle(isMobile)}>
        {t("home.heroTitle")}{" "}
        <span style={heroGradientTextStyle(theme)}>
          {t("home.heroHighlight")}
        </span>
      </h1>

      <div style={heroPillarsRowStyle(isMobile, theme)}>
        <span style={heroPillarItemStyle}>
          <ShieldOutlinedIcon sx={iconSx} />
          {t("home.heroPillars.privacy")}
        </span>
        <span style={heroPillarItemStyle}>
          <WifiOffOutlinedIcon sx={iconSx} />
          {t("home.heroPillars.offline")}
        </span>
        <span style={heroPillarItemStyle}>
          <CodeOutlinedIcon sx={iconSx} />
          {t("home.heroPillars.openSource")}
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
          {t("home.heroPillars.ai")}
        </span>
      </div>
    </header>
  );
}

/* ===================== COMPONENT ===================== */
export default function Home() {
  const { t } = useTranslation();
  const {
    secondaryTextColor,
    sectionBase,
    cardStyle,
    selectedCategoryId,
    selectedCategoryLabel,
    setSelectedCategoryId,
    visibleCategoryOptions,
  } = useOutletContext<AppOutletContext>();

  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isOnline = useOnlineStatus();
  const isMobile = useMediaQuery("(max-width:700px)");
  const isTablet = useMediaQuery("(max-width:1050px)");
  const { language } = useLanguage();
  const typedServiceCards = useServiceCards();
  const pageDescriptions = usePageDescriptions();
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
  const srOnlyHeadingStyle: CSSProperties = {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
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
  const categoriesWrapperStyle: CSSProperties = {
    width: `min(100%, ${cardsMaxWidth}px)`,
    margin: "0 auto 16px",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  };
  const categoryChipBaseStyle: CSSProperties = {
    padding: "6px 14px",
    borderRadius: 999,
    border: `1px solid ${outlinedBorderColor}`,
    backgroundColor: "transparent",
    color: secondaryTextColor,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textTransform: "none",
    lineHeight: 1.4,
  };
  const categoryChipActiveStyle: CSSProperties = {
    ...categoryChipBaseStyle,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderColor: theme.palette.primary.main,
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
      `${card.name} ${card.description} ${card.ctaLabel} ${keywordText}`.toLowerCase();
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

  const [hasInteracted, setHasInteracted] = React.useState(
    () =>
      selectedCategoryId !== "all" ||
      new URLSearchParams(window.location.search).has("q"),
  );
  React.useEffect(() => {
    if (normalizedSearchTerm || selectedCategoryId !== "all") {
      setHasInteracted(true);
    }
  }, [normalizedSearchTerm, selectedCategoryId]);

  const showHero =
    !hasInteracted && selectedCategoryId === "all" && !normalizedSearchTerm;
  const shouldForceEnglishPrefix =
    location.pathname === "/en" || location.pathname.startsWith("/en/");
  const langPath = React.useCallback(
    (path: string) =>
      withLanguagePrefix(path, language, {
        forcePrefix: language === "en" && shouldForceEnglishPrefix,
      }),
    [language, shouldForceEnglishPrefix],
  );

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + LOAD_MORE_STEP);
  };

  React.useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_CARDS);
  }, [selectedCategoryId, isOnline, searchTerm]);

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

  const categoryChips = visibleCategoryOptions.length > 0 && (
    <div style={categoriesWrapperStyle} role="group" aria-label="Categories">
      <button
        type="button"
        style={
          selectedCategoryId === "all"
            ? categoryChipActiveStyle
            : categoryChipBaseStyle
        }
        aria-pressed={selectedCategoryId === "all"}
        onClick={() => setSelectedCategoryId("all")}
      >
        {t("nav.allCategories")}
      </button>
      {visibleCategoryOptions.map((category) => {
        const isActive = category.id === selectedCategoryId;
        return (
          <button
            key={category.id}
            type="button"
            style={isActive ? categoryChipActiveStyle : categoryChipBaseStyle}
            aria-pressed={isActive}
            onClick={() => setSelectedCategoryId(category.id)}
          >
            {category.label}
          </button>
        );
      })}
    </div>
  );

  const searchInput = (
    <div style={searchWrapperStyle}>
      <TextField
        fullWidth
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder={t("home.searchPlaceholder")}
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
          {t("home.offlineTitle")}
        </h1>
        <h2 style={srOnlyHeadingStyle}>{t("home.offlineTitle")}</h2>

        <p
          style={{
            ...secondaryText,
            textAlign: "center",
            maxWidth: 480,
            margin: "0 auto 32px",
          }}
        >
          {t("home.offlineBody")}
        </p>

        {categoryChips}

        {searchInput}

        <div style={cardsGridStyle}>
          {visibleOfflineCards.map((card) => {
            const Icon = toolIcons[card.id];
            return (
              <div
                key={card.id}
                className="card-hover"
                style={cardStyle}
                onClick={() => navigate(langPath(card.path))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    navigate(langPath(card.path));
                }}
              >
                {Icon && <Icon sx={{ mb: 1, fontSize: 32 }} />}
                <h3>{card.name}</h3>
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
                ? t("home.noOfflineMatch")
                : t("home.noOfflineTools")}
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
              {t("home.loadMore")}
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
          <h2 style={srOnlyHeadingStyle}>{selectedCategoryLabel}</h2>
        )}

        {showHero && (
          <div
            style={{
              ...searchWrapperStyle,
              ...seoTextBlockStyle(isMobile, secondaryTextColor),
            }}
          >
            <p style={{ margin: 0 }}>
              {pageDescriptions.home.seoText.map((text, i) => (
                <span key={i}>
                  {i > 0 && (
                    <>
                      <br />
                      <br />
                    </>
                  )}
                  {text}
                </span>
              ))}
            </p>
          </div>
        )}

        {categoryChips}

        {searchInput}

        <div style={cardsGridStyle}>
          {visibleCards.map((card) => {
            const Icon = toolIcons[card.id];
            return (
              <div
                key={card.id}
                className="card-hover"
                style={cardStyle}
                onClick={() => navigate(langPath(card.path))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    navigate(langPath(card.path));
                }}
              >
                {Icon && <Icon sx={{ mb: 1, fontSize: 32 }} />}
                <h3>{card.name}</h3>
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
                t("home.noToolsInCategory")
              ) : (
                <>
                  {t("home.noServicesFound")}{" "}
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
              {t("home.loadMore")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
