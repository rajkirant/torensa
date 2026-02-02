import React from "react";
import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";

import { PrimaryButton } from "../components/Buttons";
import serviceCards from "../metadata/serviceCards.json";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/* ===================== TYPES ===================== */
type ServiceCardConfig = {
  id: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
  offlineEnabled: boolean;
  authRequired?: boolean;
  pageId?: string;
};

type HomeProps = {
  secondaryTextColor: string;
  sectionBase: React.CSSProperties;
  cardStyle: React.CSSProperties;
};

/* ===================== DATA (JSON) ===================== */
const typedServiceCards = (serviceCards as ServiceCardConfig[]) ?? [];

/* ===================== COMPONENT ===================== */
export default function Home({
  secondaryTextColor,
  sectionBase,
  cardStyle,
}: HomeProps) {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const secondaryText: CSSProperties = {
    color: secondaryTextColor,
  };

  // Safety guard (never crash)
  const cards = Array.isArray(typedServiceCards) ? typedServiceCards : [];
  const offlineCards = cards.filter((card) => card.offlineEnabled);

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
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 28,
          }}
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
      <h2 style={{ textAlign: "center", marginBottom: 40 }}>Services</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 28,
        }}
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
