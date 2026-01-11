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
import { themes } from "./theme";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import type { ThemeName } from "./theme";
import HomeIcon from "@mui/icons-material/Home";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LogoutIcon from "@mui/icons-material/Logout";
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
  const navBase = { ...navLinkBase, color: theme.header.textMuted };

  const secondaryText: React.CSSProperties = {
    color: theme.palette.text.secondary,
  };

  return (
    <>
      {/* ================= HEADER ================= */}
      <header style={headerStyle(theme)}>
        <Link to="/" style={{ ...brandLinkStyle, color: theme.header.text }}>
          Torensa
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <NavButton
            component={NavLink}
            to="/"
            end
            icon={<HomeIcon />}
            startIcon={<HomeIcon />} // required by MUI Button
          >
            Home
          </NavButton>
          <NavButton
            component={NavLink}
            to="/contact"
            startIcon={<ContactMailIcon />}
          >
            Contact
          </NavButton>

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
          {!loading &&
            (user ? (
              <>
                <span
                  style={{ color: "#ffffff", fontWeight: 600, fontSize: 14 }}
                >
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
                >
                  Login
                </NavButton>

                <NavButton
                  component={NavLink}
                  to="/signup"
                  startIcon={<PersonAddIcon />}
                >
                  Sign up
                </NavButton>
              </>
            ))}
        </nav>
      </header>

      {/* ================= CONTENT ================= */}
      <div className="container">
        <main>
          <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
            <Routes>
              <Route
                path="/"
                element={
                  <>
                    {/* HERO */}
                    <section
                      style={{
                        minHeight: "55vh",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        textAlign: "center",
                      }}
                    >
                      <h1
                        style={{
                          fontSize: 64,
                          fontWeight: 900,
                          letterSpacing: 1,
                          color: "#1e40af",
                          textShadow:
                            "0 0 8px rgba(59,130,246,0.6), 0 0 18px rgba(99,102,241,0.45)",
                          marginBottom: 10,
                        }}
                      >
                        Torensa
                      </h1>

                      <p
                        style={{
                          fontSize: 20,
                          ...secondaryText,
                          marginBottom: 28,
                        }}
                      >
                        Freelance Software Developer
                      </p>

                      <Button
                        variant="contained"
                        size="large"
                        endIcon={<ArrowForwardIcon />}
                        href="#/contact"
                        sx={{
                          px: 4,
                          py: 1.4,
                          borderRadius: 3,
                          textTransform: "none",
                          fontWeight: 700,
                          background:
                            "linear-gradient(135deg, #2563eb, #1e40af)",
                          boxShadow: "0 10px 30px rgba(37,99,235,0.45)",
                        }}
                      >
                        Start a Project
                      </Button>
                    </section>

                    {/* SERVICES */}
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

                    {/* ABOUT */}
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

      {/* ================= FOOTER (FULL WIDTH) ================= */}
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
