import React from "react";
import { Routes, Route, NavLink, Link } from "react-router-dom";
import { Suspense, lazy } from "react";
import { NavButton, PrimaryButton } from "./components/Buttons";
import { useAuth } from "./auth";
import {
  brandLinkStyle,
  navLinkBase,
  sectionBase,
  headerStyle,
  cardStyle,
  footerStyle,
  footerCard,
} from "./styles/appStyles";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { themes } from "./theme";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import HomeIcon from "@mui/icons-material/Home";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import type { ThemeName } from "./theme";

/* ===================== LAZY LOAD PAGES ===================== */
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const BulkEmail = lazy(() => import("./pages/BulkEmail/BulkEmail"));
const ExcelUploadToCsv = lazy(() => import("./pages/ExcelUploadToCsv"));

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

  const secondaryText: React.CSSProperties = {
    color: theme.palette.text.secondary,
  };

  const NavItems = ({ onClick }: { onClick?: () => void }) => (
    <>
      <NavButton
        component={NavLink}
        to="/"
        end
        startIcon={<HomeIcon />}
        onClick={onClick}
      >
        Home
      </NavButton>

      <NavButton
        component={NavLink}
        to="/contact"
        startIcon={<ContactMailIcon />}
        onClick={onClick}
      >
        Contact
      </NavButton>

      {!loading &&
        (user ? (
          <>
            <span style={{ color: "#ffffff", fontWeight: 600, fontSize: 14 }}>
              Hi, {user.username}
            </span>

            <NavButton
              component={NavLink}
              to="#"
              startIcon={<LogoutIcon />}
              onClick={async () => {
                await fetch("/api/logout/", {
                  method: "POST",
                  credentials: "include",
                });
                setUser(null);
                onClick?.();
              }}
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
            >
              Login
            </NavButton>

            <NavButton
              component={NavLink}
              to="/signup"
              startIcon={<PersonAddIcon />}
              onClick={onClick}
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

        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {!isMobile && (
            <>
              <NavItems />
              <Select
                size="small"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value as ThemeName)}
                sx={{ color: theme.header.text }}
              >
                {Object.keys(themes).map((name) => (
                  <MenuItem key={name} value={name}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </>
          )}

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

      {/* ================= MOBILE DRAWER ================= */}
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
          <NavItems onClick={() => setMobileOpen(false)} />

          <Select
            size="small"
            value={themeName}
            onChange={(e) => setThemeName(e.target.value as ThemeName)}
          >
            {Object.keys(themes).map((name) => (
              <MenuItem key={name} value={name}>
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Drawer>

      {/* ================= CONTENT ================= */}
      <div className="container">
        <main>
          <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
            <Routes>
              <Route
                path="/"
                element={
                  <>
                    <section style={sectionBase}>
                      <h2 style={{ textAlign: "center", marginBottom: 40 }}>
                        Services
                      </h2>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(260px, 1fr))",
                          gap: 28,
                        }}
                      >
                        <div
                          style={{
                            ...cardStyle,
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                          onClick={() =>
                            (window.location.hash = "#/bulk-email")
                          }
                        >
                          <h3 style={{ marginBottom: 12 }}>Bulk Email</h3>
                          <p style={secondaryText}>
                            Send emails to multiple recipients quickly and
                            securely.
                          </p>
                          <PrimaryButton size="small">
                            Open Bulk Email
                          </PrimaryButton>
                        </div>

                        <div
                          style={{
                            ...cardStyle,
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                          onClick={() =>
                            (window.location.hash = "#/excel-to-csv")
                          }
                        >
                          <h3 style={{ marginBottom: 12 }}>Excel to CSV</h3>
                          <p style={secondaryText}>
                            Upload Excel files and convert them to CSV using a
                            secure backend service.
                          </p>
                          <PrimaryButton size="small">
                            Convert Excel
                          </PrimaryButton>
                        </div>

                        <div style={cardStyle}>
                          <h3>DevOps</h3>
                          <p style={secondaryText}>
                            Dockerised deployments and CI/CD pipelines.
                          </p>
                        </div>
                      </div>
                    </section>

                    <section style={{ ...sectionBase, paddingTop: 40 }}>
                      <h2>About Me</h2>
                      <p style={secondaryText}>
                        I build scalable, secure applications with a strong
                        focus on clean architecture, performance, and long-term
                        maintainability.
                      </p>
                    </section>
                  </>
                }
              />

              <Route path="/bulk-email" element={<BulkEmail />} />
              <Route path="/excel-to-csv" element={<ExcelUploadToCsv />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
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
          >
            <LinkedInIcon
              sx={{ fontSize: 30, color: theme.header.text, marginBottom: 12 }}
            />
          </a>

          <div style={{ fontSize: 13, color: theme.header.textMuted }}>
            © 2026 Torensa. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
