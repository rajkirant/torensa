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

import { PrimaryButton } from "../components/buttons/PrimaryButton";
import serviceCards from "../metadata/serviceCards.json";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import type { AppOutletContext } from "../App";
import {
  type ServiceCardConfig,
  getActiveServiceCards,
  getOfflineServiceCards,
  getServiceCardsByCategory,
} from "../utils/serviceCards";

/* ===================== DATA (JSON) ===================== */
const typedServiceCards = (serviceCards as ServiceCardConfig[]) ?? [];
const INITIAL_VISIBLE_CARDS = 9;
const LOAD_MORE_STEP = 6;

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

  const searchInput = (
    <div style={searchWrapperStyle}>
      <TextField
        fullWidth
        size="small"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search tools by name, description, or keyword"
        aria-label="Search tools"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: searchTerm ? (
            <InputAdornment position="end">
              <IconButton
                aria-label="Clear search"
                size="small"
                onClick={() => setSearchTerm("")}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        }}
      />
    </div>
  );

  // 🔥 OFFLINE: show message + only offlineEnabled tools
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
          {visibleOfflineCards.map((card) => (
            <div
              key={card.id}
              style={cardStyle}
              onClick={() => navigate(card.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(card.path);
              }}
            >
              <h3>{card.title}</h3>
              <p style={secondaryText}>{card.description}</p>
              <PrimaryButton size="small">{card.ctaLabel}</PrimaryButton>
            </div>
          ))}

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

  // ✅ ONLINE: show all services
  return (
    <section style={sectionBase}>
      <h1 style={{ textAlign: "center", margin: "0 0 20px" }}>
        {selectedCategoryLabel}
      </h1>

      {searchInput}

      <div style={cardsGridStyle}>
        {visibleCards.map((card) => (
          <div
            key={card.id}
            style={cardStyle}
            onClick={() => navigate(card.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") navigate(card.path);
            }}
          >
            <h3>{card.title}</h3>
            <p style={secondaryText}>{card.description}</p>
            <PrimaryButton size="small">{card.ctaLabel}</PrimaryButton>
          </div>
        ))}

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
    </section>
  );
}
