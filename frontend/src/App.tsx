import React, { useCallback } from "react";
import { NavLink, Link, Outlet } from "react-router-dom";
import { Suspense } from "react";

import { NavButton } from "./components/Buttons";
import { useAuth } from "./utils/auth";
import { clearCsrfToken } from "./utils/csrf";
import { apiFetch } from "./utils/api";

import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import CircularProgress from "@mui/material/CircularProgress";

import HomeIcon from "@mui/icons-material/Home";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import LinkedInIcon from "@mui/icons-material/LinkedIn";

import {
  brandLinkStyle,
  sectionBase,
  headerStyle,
  drawerNavButtonStyle,
  cardStyle,
  footerStyle,
  footerCard,
  navStyle,
  themeSelectSx,
  userGreetingStyle,
} from "./styles/appStyles";

import { themes } from "./theme";
import type { ThemeName } from "./theme";

/* ===================== TYPES ===================== */
type AppProps = {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
};

/**
 * Outlet context provided to pages (e.g. Home)
 * so Root.tsx can keep routes simple: <Home />
 */
export type AppOutletContext = {
  secondaryTextColor: string;
  sectionBase: typeof sectionBase;
  cardStyle: typeof cardStyle;
};

export default function App({ themeName, setThemeName }: AppProps) {
  const theme = themes[themeName];
  const { user, loading, setUser } = useAuth();
  const isMobile = useMediaQuery("(max-width:900px)");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const headerTextColor = isMobile
    ? theme.palette.text.primary
    : theme.header.text;

  const secondaryTextColor = theme.palette.text.secondary;

  const handleLogout = useCallback(async () => {
    try {
      await apiFetch("/api/logout/", { method: "POST", csrf: true });
    } finally {
      clearCsrfToken();
      setUser(null);
      setMobileOpen(false);
    }
  }, [setUser]);

  /* ===================== NAV ITEMS ===================== */
  type NavItemsProps = {
    onClick?: () => void;
    onLogout: () => void;
    sx?: any;
  };

  const NavItems = ({ onClick, onLogout, sx }: NavItemsProps) => (
    <>
      <NavButton
        component={NavLink}
        to="/"
        end
        startIcon={<HomeIcon />}
        onClick={onClick}
        sx={sx}
      >
        Home
      </NavButton>

      <NavButton
        component={NavLink}
        to="/contact"
        startIcon={<ContactMailIcon />}
        onClick={onClick}
        sx={sx}
      >
        Contact
      </NavButton>

      <Select
        size="small"
        value={themeName}
        onChange={(e) => setThemeName(e.target.value as ThemeName)}
        sx={themeSelectSx(theme, isMobile, headerTextColor)}
      >
        {Object.keys(themes).map((name) => (
          <MenuItem key={name} value={name}>
            {name.charAt(0).toUpperCase() + name.slice(1)}
          </MenuItem>
        ))}
      </Select>

      {!loading &&
        (user ? (
          <>
            <span style={userGreetingStyle(headerTextColor)}>
              Hi, {user.username}
            </span>

            <NavButton
              component={NavLink}
              to="/"
              startIcon={<LogoutIcon />}
              onClick={onLogout}
              sx={sx}
            >
              Logout
            </NavButton>
          </>
        ) : (
          <>
            <NavButton
              component={NavLink}
              to="/login"
              startIcon={<LoginIcon />}
              onClick={onClick}
              sx={sx}
            >
              Login
            </NavButton>

            <NavButton
              component={NavLink}
              to="/signup"
              startIcon={<PersonAddIcon />}
              onClick={onClick}
              sx={sx}
            >
              Sign up
            </NavButton>
          </>
        ))}
    </>
  );

  return (
    <>
      <header style={headerStyle(theme)}>
        <Link to="/" style={{ ...brandLinkStyle, color: theme.header.text }}>
          Torensa
        </Link>

        <nav style={navStyle}>
          {!isMobile && <NavItems onLogout={handleLogout} />}

          {isMobile && (
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{ color: "#fff" }}
            >
              <MenuIcon fontSize="large" />
            </IconButton>
          )}
        </nav>
      </header>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      >
        <Box
          sx={{
            width: 260,
            padding: 3,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <NavItems
            onClick={() => setMobileOpen(false)}
            onLogout={handleLogout}
            sx={drawerNavButtonStyle(theme)}
          />
        </Box>
      </Drawer>

      <div className="container">
        <main>
          <Suspense
            fallback={
              <div className="loader-container">
                <CircularProgress />
              </div>
            }
          >
            <Outlet
              context={
                {
                  secondaryTextColor,
                  sectionBase,
                  cardStyle,
                } satisfies AppOutletContext
              }
            />
          </Suspense>
        </main>
      </div>

      <footer style={footerStyle(theme)}>
        <div style={footerCard}>
          <a
            href="https://www.linkedin.com/in/rajkiran/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LinkedInIcon sx={{ fontSize: 24 }} />
          </a>
          <div style={{ fontSize: 13, color: theme.header.textMuted }}>
            © {new Date().getFullYear()} Torensa. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
