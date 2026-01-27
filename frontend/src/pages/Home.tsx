import React from "react";
import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";

import { PrimaryButton } from "../components/Buttons";
import serviceCards from "../metadata/serviceCards.json";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/* types for your cards */
type ServiceCardConfig = {
  id: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
};

const typedServiceCards = serviceCards as ServiceCardConfig[];

/* props we expect from App */
type HomeProps = {
  secondaryTextColor: string;
  sectionBase: React.CSSProperties;
  cardStyle: React.CSSProperties;
};

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

  // 🔥 When offline, show "homepage not available" instead of services
  if (!isOnline) {
    return (
      <section style={{ ...sectionBase, textAlign: "center" }}>
        <h2 style={{ marginBottom: 16 }}>Homepage not available offline</h2>
        <p style={{ ...secondaryText, maxWidth: 480, margin: "0 auto" }}>
          You&apos;re currently offline. The Torensa home page requires an
          internet connection.
        </p>
        <p style={{ ...secondaryText, maxWidth: 480, margin: "12px auto 0" }}>
          You can still use specific tools like <strong>Text to QR</strong> if
          they&apos;re cached, but the main service list isn&apos;t available in
          offline mode.
        </p>
      </section>
    );
  }

  // ✅ Normal homepage when online
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
        {typedServiceCards.map((card) => (
          <div
            key={card.id}
            style={cardStyle}
            onClick={() => navigate(card.path)}
          >
            <h3>{card.title}</h3>
            <p style={secondaryText}>{card.description}</p>
            <PrimaryButton size="small">{card.ctaLabel}</PrimaryButton>
          </div>
        ))}
      </div>
    </section>
  );
}
