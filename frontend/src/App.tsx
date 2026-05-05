import React, { useCallback, useEffect, useMemo } from "react";
import {
  NavLink,
  Link,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Suspense } from "react";

import { NavButton } from "./components/buttons/NavButton";
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
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import GitHubIcon from "@mui/icons-material/GitHub";
import FacebookIcon from "@mui/icons-material/Facebook";

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

import { themes, themeIconComponents } from "./theme";
import type { ThemeName } from "./theme";
import categories from "./metadata/categories.json";
import {
  useLanguage,
  useServiceCards,
  type LanguageCode,
  withLanguagePrefix,
  stripLanguagePrefix,
} from "./utils/language";
import { useTranslation } from "react-i18next";
import {
  type ServiceCardConfig,
  getActiveServiceCards,
} from "./utils/serviceCards";

const ToolChatWidget = React.lazy(
  () => import("./components/chat/ToolChatWidget"),
);

/* ===================== TYPES ===================== */
type AppProps = {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
};

/**
 * Outlet context provided to pages (e.g. Home)
 * so Root.tsx can keep routes simple: <Home />
 */
type CategoryConfig = {
  id: string;
  label: string;
};

export type AppOutletContext = {
  secondaryTextColor: string;
  sectionBase: typeof sectionBase;
  cardStyle: typeof cardStyle;
  selectedCategoryId: string;
  selectedCategoryLabel: string;
  setSelectedCategoryId: (categoryId: string) => void;
  visibleCategoryOptions: CategoryConfig[];
};

export default function App({ themeName, setThemeName }: AppProps) {
  const { t } = useTranslation();
  const theme = themes[themeName];
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width:900px)");
  const { language, setLanguage } = useLanguage();
  const serviceCards = useServiceCards();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const categoryOptions = categories as CategoryConfig[];
  const activeCards = useMemo(
    () => getActiveServiceCards(serviceCards as ServiceCardConfig[]),
    [serviceCards],
  );
  const activeCategoryIds = useMemo(
    () =>
      new Set(
        activeCards
          .map((card) => (card.categoryId || "").trim())
          .filter((categoryId) => Boolean(categoryId)),
      ),
    [activeCards],
  );
  const visibleCategoryOptions = useMemo(
    () =>
      categoryOptions.filter((category) => activeCategoryIds.has(category.id)),
    [categoryOptions, activeCategoryIds],
  );
  const visibleCategoryIds = useMemo(
    () => new Set(visibleCategoryOptions.map((category) => category.id)),
    [visibleCategoryOptions],
  );
  const shouldShowCategorySelect = useMemo(
    () => visibleCategoryOptions.length > 0,
    [visibleCategoryOptions],
  );
  const [selectedCategoryId, setSelectedCategoryId] = React.useState(() => {
    const categoryFromUrl = new URLSearchParams(window.location.search).get(
      "categories",
    );
    return categoryFromUrl && visibleCategoryIds.has(categoryFromUrl)
      ? categoryFromUrl
      : "all";
  });
  React.useEffect(() => {
    if (
      selectedCategoryId !== "all" &&
      !visibleCategoryIds.has(selectedCategoryId)
    ) {
      setSelectedCategoryId("all");
    }
  }, [selectedCategoryId, visibleCategoryIds]);
  const selectedCategoryLabel = useMemo(
    () =>
      selectedCategoryId === "all"
        ? t("nav.allCategories")
        : (visibleCategoryOptions.find(
            (category) => category.id === selectedCategoryId,
          )?.label ?? t("nav.allCategories")),
    [selectedCategoryId, visibleCategoryOptions, t],
  );

  const headerTextColor = isMobile
    ? theme.palette.text.primary
    : theme.header.text;

  const secondaryTextColor = theme.palette.text.secondary;
  const themedCardStyle: typeof cardStyle = {
    ...cardStyle,
    background: theme.home?.card?.background ?? cardStyle.background,
    border: theme.home?.card?.border ?? cardStyle.border,
    boxShadow: theme.home?.card?.boxShadow ?? cardStyle.boxShadow,
  };

  const shouldForceEnglishPrefix =
    location.pathname === "/en" || location.pathname.startsWith("/en/");
  const langPath = useCallback(
    (path: string) =>
      withLanguagePrefix(path, language, {
        forcePrefix: language === "en" && shouldForceEnglishPrefix,
      }),
    [language, shouldForceEnglishPrefix],
  );
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
        pathname: langPath("/"),
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
          to={langPath("/")}
          end
          startIcon={<HomeIcon />}
          onClick={handleHomeClick}
          sx={sx}
        >
          {t("nav.home")}
        </NavButton>

        <NavButton
          component={NavLink}
          to={langPath("/about")}
          startIcon={<InfoOutlinedIcon />}
          onClick={onClick}
          sx={sx}
        >
          {t("nav.about")}
        </NavButton>

        <Select
          size="small"
          value={themeName}
          onChange={(e) => setThemeName(e.target.value as ThemeName)}
          inputProps={{ "aria-label": "Theme selection" }}
          sx={themeSelectSx(theme, isMobile, headerTextColor)}
        >
          {Object.keys(themes).map((name) => {
            const Icon = themeIconComponents[name];
            return (
              <MenuItem
                key={name}
                value={name}
                sx={{ display: "flex", alignItems: "center" }}
              >
                {Icon && (
                  <Icon
                    fontSize="small"
                    sx={{
                      mr: 1,
                      verticalAlign: "middle",
                      position: "relative",
                    }}
                  />
                )}
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </MenuItem>
            );
          })}
        </Select>

        <Select
          size="small"
          value={language}
          onChange={(e) => {
            const nextLanguage = e.target.value as LanguageCode;
            const strippedPath = stripLanguagePrefix(location.pathname || "/");
            const isCurrentlyPrefixedEn =
              location.pathname === "/en" ||
              location.pathname.startsWith("/en/");
            const nextPath = withLanguagePrefix(strippedPath, nextLanguage, {
              forcePrefix: nextLanguage === "en" && isCurrentlyPrefixedEn,
            });
            setLanguage(nextLanguage);
            navigate(
              {
                pathname: nextPath,
                search: location.search,
              },
              { replace: true },
            );
          }}
          inputProps={{ "aria-label": "Language selection" }}
          sx={themeSelectSx(theme, isMobile, headerTextColor)}
        >
          <MenuItem value="en">English</MenuItem>
          <MenuItem value="de">German</MenuItem>
          <MenuItem value="nl">Dutch</MenuItem>
        </Select>

        {shouldShowCategorySelect && (
          <Select
            size="small"
            value={selectedCategoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            inputProps={{ "aria-label": "Category selection" }}
            sx={{
              ...themeSelectSx(theme, isMobile, headerTextColor),
              minWidth: 170,
            }}
          >
            <MenuItem
              value="all"
              onClick={() => handleCategoryOptionClick("all")}
            >
              {t("nav.allCategories")}
            </MenuItem>
            {visibleCategoryOptions.map((category) => (
              <MenuItem
                key={category.id}
                value={category.id}
                onClick={() => handleCategoryOptionClick(category.id)}
              >
                {category.label}
              </MenuItem>
            ))}
          </Select>
        )}

        {!loading &&
          (user ? (
            <>
              <span style={userGreetingStyle(headerTextColor)}>
                {t("nav.greeting", { name: user.username })}
              </span>

              <NavButton
                component={NavLink}
                to={langPath("/")}
                startIcon={<LogoutIcon />}
                onClick={onLogout}
                sx={sx}
              >
                {t("nav.logout")}
              </NavButton>
            </>
          ) : (
            <>
              <NavButton
                component={NavLink}
                to={langPath("/login")}
                startIcon={<LoginIcon />}
                onClick={onClick}
                sx={sx}
              >
                {t("nav.login")}
              </NavButton>

              <NavButton
                component={NavLink}
                to={langPath("/signup")}
                startIcon={<PersonAddIcon />}
                onClick={onClick}
                sx={sx}
              >
                {t("nav.signup")}
              </NavButton>
            </>
          ))}
      </>
    );
  };

  return (
    <div style={appShellStyle}>
      <header style={headerStyle(theme)}>
        <Link
          to={langPath("/")}
          style={{ ...brandLinkStyle, color: theme.header.text }}
        >
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
              aria-label="Open navigation menu"
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
                  cardStyle: themedCardStyle,
                  selectedCategoryId,
                  selectedCategoryLabel,
                  setSelectedCategoryId,
                  visibleCategoryOptions,
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
              href="https://www.facebook.com/tryTorensa"
              target="_blank"
              rel="noopener noreferrer"
              style={footerLinkStyle(theme)}
              aria-label="Torensa Facebook"
            >
              <FacebookIcon sx={{ fontSize: 24, color: "inherit" }} />
            </a>
            {/* <a
              href="https://www.linkedin.com/in/rajkirant/"
              target="_blank"
              rel="noopener noreferrer"
              style={footerLinkStyle(theme)}
              aria-label="Raj Kiran LinkedIn"
            >
              <LinkedInIcon sx={{ fontSize: 24, color: "inherit" }} />
            </a> */}
          </div>
          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Link
              to={langPath("/about")}
              style={{
                fontSize: 13,
                color: theme.header.textMuted,
                textDecoration: "none",
              }}
            >
              {t("footer.about")}
            </Link>
            <Link
              to={langPath("/privacy")}
              style={{
                fontSize: 13,
                color: theme.header.textMuted,
                textDecoration: "none",
              }}
            >
              {t("footer.privacy")}
            </Link>
            <Link
              to={langPath("/terms")}
              style={{
                fontSize: 13,
                color: theme.header.textMuted,
                textDecoration: "none",
              }}
            >
              {t("footer.terms")}
            </Link>
          </div>
          <div
            style={{
              fontSize: 13,
              color: theme.header.textMuted,
              marginTop: 8,
            }}
          >
            © {new Date().getFullYear()} Torensa. {t("footer.rights")}
          </div>
        </div>
      </footer>
      <Suspense fallback={null}>
        <ToolChatWidget />
      </Suspense>
    </div>
  );
}
