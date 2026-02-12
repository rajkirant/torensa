import React, { useCallback } from "react";
import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import { Suspense } from "react";

import { NavButton } from "./components/buttons/NavButton";
import { useAuth } from "./utils/auth";
import { clearCsrfToken } from "./utils/csrf";
import { apiFetch } from "./utils/api";
import ToolChatWidget from "./components/chat/ToolChatWidget";

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
import GitHubIcon from "@mui/icons-material/GitHub";

import {
    brandLinkStyle,
    sectionBase,
    headerStyle,
    drawerNavButtonStyle,
    cardStyle,
    appShellStyle,
    contentShellStyle,
    footerStyle,
    navStyle,
    themeSelectSx,
    userGreetingStyle,
    footerInner,
    footerLinksRow,
    footerLinkStyle,
} from "./styles/appStyles";

import { themes } from "./theme";
import type { ThemeName } from "./theme";
import categories from "./metadata/categories.json";

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
  selectedCategoryId: string;
  selectedCategoryLabel: string;
};

type CategoryConfig = {
  id: string;
  label: string;
};

export default function App({ themeName, setThemeName }: AppProps) {
  const theme = themes[themeName];
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width:900px)");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const categoryOptions = categories as CategoryConfig[];
  const categoryIds = new Set(categoryOptions.map((category) => category.id));
  const [selectedCategoryId, setSelectedCategoryId] = React.useState(() => {
    const categoryFromUrl = new URLSearchParams(window.location.search).get(
      "categories",
    );
    return categoryFromUrl && categoryIds.has(categoryFromUrl)
      ? categoryFromUrl
      : "all";
  });
  const selectedCategoryLabel =
    selectedCategoryId === "all"
      ? "All Categories"
      : categoryOptions.find((category) => category.id === selectedCategoryId)
          ?.label ?? "All Categories";

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

  const NavItems = ({ onClick, onLogout, sx }: NavItemsProps) => {
    const handleHomeClick = () => {
      setSelectedCategoryId("all");
      onClick?.();
    };

    const navigateToCategoryListing = (categoryId: string) => {
      onClick?.();
      navigate({
        pathname: "/",
        search:
          categoryId === "all"
            ? ""
            : `?categories=${encodeURIComponent(categoryId)}`,
      });
    };

    const handleCategoryChange = (nextCategoryId: string) => {
      setSelectedCategoryId(nextCategoryId);
      navigateToCategoryListing(nextCategoryId);
    };

    const handleCategoryOptionClick = (categoryId: string) => {
      if (categoryId === selectedCategoryId) {
        navigateToCategoryListing(categoryId);
      }
    };

    return (
      <>
        <NavButton
          component={NavLink}
          to="/"
          end
          startIcon={<HomeIcon />}
          onClick={handleHomeClick}
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

        <Select
          size="small"
          value={selectedCategoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
          sx={{
            ...themeSelectSx(theme, isMobile, headerTextColor),
            minWidth: 170,
        }}
      >
        <MenuItem value="all" onClick={() => handleCategoryOptionClick("all")}>
          All Categories
        </MenuItem>
        {categoryOptions.map((category) => (
          <MenuItem
            key={category.id}
            value={category.id}
            onClick={() => handleCategoryOptionClick(category.id)}
          >
            {category.label}
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
  };

  return (
    <div style={appShellStyle}>
      <header style={headerStyle(theme)}>
        <Link to="/" style={{ ...brandLinkStyle, color: theme.header.text }}>
          <img
            src="/favicon.svg"
            alt="Torensa"
            width={26}
            height={26}
            style={{ display: "block" }}
          />
          <span>Torensa.com</span>
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

      <div className="container" style={contentShellStyle}>
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
                  selectedCategoryId,
                  selectedCategoryLabel,
                } satisfies AppOutletContext
              }
            />
          </Suspense>
        </main>
      </div>

      <footer style={footerStyle(theme)}>
        <div style={footerInner}>
          <div style={footerLinksRow}>
            <a
              href="https://github.com/rajkirant/torensa"
              target="_blank"
              rel="noopener noreferrer"
              style={footerLinkStyle(theme)}
              aria-label="Torensa GitHub"
            >
              <GitHubIcon sx={{ fontSize: 24, color: "inherit" }} />
            </a>
            <a
              href="https://www.linkedin.com/in/rajkirant/"
              target="_blank"
              rel="noopener noreferrer"
              style={footerLinkStyle(theme)}
              aria-label="Raj Kiran LinkedIn"
            >
              <LinkedInIcon sx={{ fontSize: 24, color: "inherit" }} />
            </a>
          </div>
          <div style={{ fontSize: 13, color: theme.header.textMuted }}>
            © {new Date().getFullYear()} Torensa. All rights reserved.
          </div>
        </div>
      </footer>
      <ToolChatWidget />
    </div>
  );
}
