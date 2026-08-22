import { useEffect, useState } from "react";
import { Theme } from "@mui/material/styles";

import { footerBadgesRow, footerLinkStyle } from "../../styles/appStyles";

const VISIBLE_MS = 5000;

type FooterBadgesProps = {
  theme: Theme;
};

export default function FooterBadges({ theme }: FooterBadgesProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div style={footerBadgesRow}>
      <a
        href="https://twelve.tools"
        target="_blank"
        rel="noopener noreferrer"
        style={footerLinkStyle(theme)}
        aria-label="Torensa featured on Twelve Tools"
      >
        <img
          src="https://twelve.tools/badge0-white.svg"
          alt="Featured on Twelve Tools"
          width={148}
          height={40}
          loading="lazy"
        />
      </a>
    </div>
  );
}
