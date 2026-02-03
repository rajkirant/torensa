import { styled, keyframes } from "@mui/material/styles";
import Button, { type ButtonProps } from "@mui/material/Button";
import type { ReactNode } from "react";

/* =========================
   PRIMARY BUTTON
   ========================= */

const softPulse = keyframes`
  0% {
    box-shadow: 
      0 4px 10px rgba(0,0,0,0.25),
      inset 0 1px 0 rgba(255,255,255,0.35);
  }
  50% {
    box-shadow: 
      0 6px 14px rgba(59,130,246,0.45),
      inset 0 1px 0 rgba(255,255,255,0.45);
  }
  100% {
    box-shadow: 
      0 4px 10px rgba(0,0,0,0.25),
      inset 0 1px 0 rgba(255,255,255,0.35);
  }
`;

export const PrimaryButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
  textTransform: "none",
  fontWeight: 600,
  padding: "9.6px 20px",
  borderRadius: "14px",

  color: "#ffffff",
  background: "linear-gradient(135deg, #3b82f6, #1e40af)",

  animation: `${softPulse} 3.5s ease-in-out infinite`,
  transition: "transform 0.2s ease, box-shadow 0.2s ease",

  "&:hover": {
    animation: "none",
    boxShadow:
      "0 6px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.45)",
    transform: "translateY(-2px)",
  },

  "&:active": {
    boxShadow: "0 3px 6px rgba(0,0,0,0.35), inset 0 3px 6px rgba(0,0,0,0.45)",
    transform: "translateY(1px)",
  },

  "&.Mui-disabled": {
    animation: "none",
    color: "rgba(255,255,255,0.7)",
    background: "linear-gradient(135deg, #93c5fd, #60a5fa)",
  },
}));

/* =========================
   NAV BUTTON
   ========================= */

export interface NavButtonProps extends ButtonProps {
  to?: string;
  end?: boolean;
}

export const NavButton = styled(Button)<NavButtonProps>(({ theme }) => ({
  textTransform: "none",
  fontWeight: 600,
  fontSize: "0.95rem",
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  color: theme.header.textMuted,

  "& .MuiButton-startIcon": {
    marginRight: theme.spacing(0.5),
  },

  "&.active": {
    color: theme.header.text,
    textDecoration: "underline",
  },
}));
