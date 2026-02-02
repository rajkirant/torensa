import React, { useCallback } from "react";
import { Routes, Route, NavLink, Link } from "react-router-dom";
import { Suspense, lazy } from "react";

import { NavButton } from "./components/Buttons";
import { useAuth } from "./utils/auth";
import { clearCsrfToken } from "./utils/csrf";
import { apiFetch } from "./utils/api";
import ProtectedRoute from "./utils/ProtectedRoute";

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

// ✅ same JSON Home uses (routes come from here)
import serviceCards from "./metadata/serviceCards.json";

/* ===================== LAZY LOAD PAGES ===================== */
const Home = lazy(() => import("./pages/Home"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));

// Tool pages (lazy)
const BulkEmail = lazy(() => import("./pages/BulkEmail/BulkEmail"));
const TextToQr = lazy(() => import("./pages/TextToQr"));
const ExcelUploadToCsv = lazy(() => import("./pages/ExcelUploadToCsv"));
const ImageCompressor = lazy(() => import("./pages/ImageCompressor"));
const PdfMerger = lazy(() => import("./pages/imagePdfToPdf"));
const InvoiceGenerator = lazy(() => import("./pages/InvoiceGenerator"));

/* ===================== TYPES ===================== */
type AppProps = {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
};

type ServiceCardConfig = {
  id: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
  offlineEnabled: boolean;
  authRequired?: boolean; // optional for ProtectedRoute
  pageId?: string; // optional if you want different key than id
};

/**
 * Map JSON ids/pageIds -> actual page components
 * ✅ This is the “bridging” piece between JSON and real code.
 */
const toolComponentMap: Record<string, React.LazyExoticComponent<any>> = {
  "bulk-email": BulkEmail,
  "excel-to-csv": ExcelUploadToCsv,
  "text-to-qr": TextToQr,
  "image-compressor": ImageCompressor,
  "image-pdf-to-pdf": PdfMerger,
  "invoice-generator": InvoiceGenerator,
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

  /* ===================== TOOL ROUTES (from JSON) ===================== */
  const tools = serviceCards as ServiceCardConfig[];

  const toolRoutes = tools.map((tool) => {
    const key = (tool.pageId ?? tool.id).toLowerCase();
    const Page = toolComponentMap[key];

    if (!Page) {
      console.warn(
        `No component mapped for tool key "${key}" (path: ${tool.path})`,
      );
      return null;
    }

    const element = tool.authRequired ? (
      <ProtectedRoute>
        <Page />
      </ProtectedRoute>
    ) : (
      <Page />
    );

    return <Route key={tool.id} path={tool.path} element={element} />;
  });

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

              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* ✅ Auto tool routes */}
              {toolRoutes}
            </Routes>
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
