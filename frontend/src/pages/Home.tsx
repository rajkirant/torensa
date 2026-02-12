import React from "react";
import { useNavigate, useOutletContext, useLocation } from "react-router-dom";
import type { CSSProperties } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";

import { PrimaryButton } from "../components/buttons/PrimaryButton";
import serviceCards from "../metadata/serviceCards.json";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import type { AppOutletContext } from "../App";

/* ===================== TYPES ===================== */
type ServiceCardConfig = {
  id: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
  offlineEnabled: boolean;
  categoryId: string;
  authRequired?: boolean;
};

/* ===================== DATA (JSON) ===================== */
const typedServiceCards = (serviceCards as ServiceCardConfig[]) ?? [];

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
  const isOnline = useOnlineStatus();
  const isMobile = useMediaQuery("(max-width:700px)");
  const isTablet = useMediaQuery("(max-width:1050px)");
  const columns = isMobile ? 1 : isTablet ? 2 : 3;

  const secondaryText: CSSProperties = {
    color: secondaryTextColor,
  };
  const cardsGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(260px, 320px))`,
    justifyContent: "center",
    gap: 28,
  };

  // Safety guard (never crash)
  const allCards = Array.isArray(typedServiceCards) ? typedServiceCards : [];
  const cards =
    selectedCategoryId === "all"
      ? allCards
      : allCards.filter((card) => card.categoryId === selectedCategoryId);
  const offlineCards = cards.filter((card) => card.offlineEnabled);

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

  // 🔥 OFFLINE: show message + only offlineEnabled tools
  if (!isOnline) {
    return (
      <section style={sectionBase}>
        <h2 style={{ textAlign: "center", marginBottom: 16 }}>
          Limited offline mode
        </h2>

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

        <div
          style={cardsGridStyle}
        >
          {offlineCards.map((card) => (
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

          {offlineCards.length === 0 && (
            <p
              style={{
                ...secondaryText,
                textAlign: "center",
                gridColumn: "1 / -1",
              }}
            >
              No tools are available offline yet.
            </p>
          )}
        </div>
      </section>
    );
  }

  // ✅ ONLINE: show all services
  return (
    <section style={sectionBase}>
      <h2 style={{ textAlign: "center", marginBottom: 40 }}>
        {selectedCategoryLabel}
      </h2>

      <div
        style={cardsGridStyle}
      >
        {cards.map((card) => (
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

        {cards.length === 0 && (
          <p
            style={{
              ...secondaryText,
              textAlign: "center",
              gridColumn: "1 / -1",
            }}
          >
            No services found. Add entries to{" "}
            <code>metadata/serviceCards.json</code>.
          </p>
        )}
      </div>
    </section>
  );
}
