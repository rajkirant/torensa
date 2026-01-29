import React, { useCallback } from "react";
import { Routes, Route, NavLink, Link } from "react-router-dom";
import { Suspense, lazy } from "react";
import { NavButton, PrimaryButton } from "./components/Buttons";
import { useAuth } from "./utils/auth";
import { clearCsrfToken } from "./utils/csrf";

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

import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import CircularProgress from "@mui/material/CircularProgress";

import { themes } from "./theme";
import type { ThemeName } from "./theme";

import HomeIcon from "@mui/icons-material/Home";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import { apiFetch } from "./utils/api";
import ProtectedRoute from "./utils/ProtectedRoute";

/* ===================== LAZY LOAD PAGES ===================== */

const Home = lazy(() => import("./pages/Home"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const BulkEmail = lazy(() => import("./pages/BulkEmail/BulkEmail"));
const TextToQr = lazy(() => import("./pages/TextToQr"));
const ExcelUploadToCsv = lazy(() => import("./pages/ExcelUploadToCsv"));
const ImageCompressor = lazy(() => import("./pages/ImageCompressor"));
const PdfMerger = lazy(() => import("./pages/imagePdfToPdf"));

/* ===================== TYPES ===================== */
type AppProps = {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
};

/* ===================== APP ===================== */
export default function App({ themeName, setThemeName }: AppProps) {
  const theme = themes[themeName];
  const { user, loading, setUser } = useAuth();
  const isMobile = useMediaQuery("(max-width:900px)");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const headerTextColor = isMobile
    ? theme.palette.text.primary
    : theme.header.text;

  // just the color we’ll pass down to Home
  const secondaryTextColor = theme.palette.text.secondary;

  const handleLogout = useCallback(async () => {
    try {
      await apiFetch("/api/logout/", {
        method: "POST",
        csrf: true,
      });
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
        displayEmpty
        inputProps={{ "aria-label": "Theme selection" }}
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
      {/* ================= HEADER ================= */}
      <header style={headerStyle(theme)}>
        <Link to="/" style={{ ...brandLinkStyle, color: theme.header.text }}>
          Torensa
        </Link>

        <nav style={navStyle}>
          {!isMobile && <NavItems onLogout={handleLogout} />}

          {isMobile && (
            <IconButton
              aria-label="Open navigation menu"
              aria-controls="mobile-menu-drawer"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
              sx={{ color: "#fff" }}
            >
              <MenuIcon fontSize="large" />
            </IconButton>
          )}
        </nav>
      </header>

      {/* ================= MOBILE DRAWER ================= */}
      <Drawer
        id="mobile-menu-drawer"
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
            },
          },
        }}
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

      {/* ================= CONTENT ================= */}
      <div className="container">
        <main>
          <Suspense
            fallback={
              <div className="loader-container">
                <CircularProgress />
              </div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={
                  <Home
                    secondaryTextColor={secondaryTextColor}
                    sectionBase={sectionBase}
                    cardStyle={cardStyle}
                  />
                }
              />

              <Route
                path="/bulk-email"
                element={
                  <ProtectedRoute>
                    <BulkEmail />
                  </ProtectedRoute>
                }
              />
              <Route path="/excel-to-csv" element={<ExcelUploadToCsv />} />
              <Route path="/text-to-qr" element={<TextToQr />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/image-compressor" element={<ImageCompressor />} />
                <Route path="/image-pdf-to-pdf" element={<PdfMerger />} />

            </Routes>
          </Suspense>
        </main>
      </div>

      {/* ================= FOOTER ================= */}
      <footer style={footerStyle(theme)}>
        <div style={footerCard}>
          <a
            href="https://www.linkedin.com/in/rajkirant/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Rajkiran on LinkedIn"
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
