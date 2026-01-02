import React from "react";
import { Routes, Route, NavLink, Link } from "react-router-dom";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import { useAuth } from "./auth";
import BulkEmail from "./pages/BulkEmail";

import Button from "@mui/material/Button";

import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useTheme } from "@mui/material/styles";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import Signup from "./pages/Signup";

/* ===================== TYPES ===================== */

type AppProps = {
  themeName: "default" | "dark";
  setThemeName: (name: "default" | "dark") => void;
};

/* ===================== STATIC STYLES ===================== */

const brandLinkStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#ffffff",
  textDecoration: "none",
  letterSpacing: 0.8,
};

const navLinkBase: React.CSSProperties = {
  textDecoration: "none",
  fontWeight: 500,
  color: "#e5e7eb",
};

const sectionBase: React.CSSProperties = {
  padding: "64px 24px",
  maxWidth: 1100,
  margin: "0 auto",
};

/* ===================== APP ===================== */

export default function App({ themeName, setThemeName }: AppProps) {
  const { user, loading, setUser } = useAuth();
  const theme = useTheme();

  /* ---------- STYLES ---------- */

  const headerGradient = "linear-gradient(90deg, #020617, #0b3aa4, #3b0ca3)";

  const headerStyle: React.CSSProperties = {
    background: headerGradient,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 40px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
  };

  const secondaryText: React.CSSProperties = {
    color: theme.palette.text.secondary,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.palette.background.paper,
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 18px 36px rgba(0,0,0,0.3)",
  };

  /* ---------- FOOTER (UPDATED) ---------- */

  const footerStyle: React.CSSProperties = {
    marginTop: 80,
    padding: "64px 24px 40px",
    background: headerGradient,
    borderTop: "1px solid rgba(255,255,255,0.12)",
  };

  const footerCard: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
    padding: "48px 32px",
    borderRadius: 24,
    backgroundColor: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(255,255,255,0.15)",
    textAlign: "center",
    backdropFilter: "blur(6px)",
  };

  return (
    <div className="container">
      {/* ================= HEADER ================= */}
      <header style={headerStyle}>
        <Link to="/" style={brandLinkStyle}>
          Torensa
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) =>
              isActive
                ? { ...navLinkBase, color: "#fff", textDecoration: "underline" }
                : navLinkBase
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/contact"
            style={({ isActive }) =>
              isActive
                ? { ...navLinkBase, color: "#fff", textDecoration: "underline" }
                : navLinkBase
            }
          >
            Contact
          </NavLink>

          <Select
            size="small"
            value={themeName}
            onChange={(e) => setThemeName(e.target.value as "default" | "dark")}
            sx={{
              color: "#fff",
              height: 32,
              ".MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(255,255,255,0.4)",
              },
            }}
          >
            <MenuItem value="default">Default</MenuItem>
            <MenuItem value="dark">Dark</MenuItem>
          </Select>

          {!loading &&
            (user ? (
              <>
                <span
                  style={{
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Hi, {user.username}
                </span>

                <NavLink
                  to="/bulk-email"
                  style={({ isActive }) =>
                    isActive
                      ? {
                          ...navLinkBase,
                          color: "#fff",
                          textDecoration: "underline",
                        }
                      : navLinkBase
                  }
                >
                  Bulk Email
                </NavLink>

                <Button
                  variant="outlined"
                  size="small"
                  sx={{ color: "#fff", borderColor: "#c7d2fe" }}
                  onClick={async () => {
                    await fetch("/api/logout/", {
                      method: "POST",
                      credentials: "include",
                    });
                    setUser(null);
                  }}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" style={{ color: "#fff" }}>
                  Login
                </Link>
                <Link to="/signup" style={{ color: "#fff" }}>
                  Sign up
                </Link>
              </>
            ))}
        </nav>
      </header>

      {/* ================= MAIN ================= */}
      <main>
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
                      background: "linear-gradient(135deg, #2563eb, #1e40af)",
                      boxShadow: "0 10px 30px rgba(37,99,235,0.45)",
                      "&:hover": {
                        background: "linear-gradient(135deg, #1e40af, #1e3a8a)",
                      },
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
                    <div style={cardStyle}>
                      <h3>Frontend Development</h3>
                      <p style={secondaryText}>
                        Modern, responsive React applications.
                      </p>
                    </div>

                    <div style={cardStyle}>
                      <h3>Backend APIs</h3>
                      <p style={secondaryText}>
                        Secure and scalable Spring Boot APIs.
                      </p>
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
                    I build scalable, secure applications with a strong focus on
                    clean architecture, performance, and long-term
                    maintainability.
                  </p>
                </section>
              </>
            }
          />
          <Route path="/bulk-email" element={<BulkEmail />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </main>

      {/* ================= FOOTER ================= */}
      <footer style={footerStyle}>
        <div style={footerCard}>
          <strong style={{ color: "#ffffff" }}>Torensa</strong>

          <p style={{ marginTop: 10, color: "#e5e7eb" }}>
            Freelance software developer specialising in scalable and secure web
            applications.
          </p>

          <a
            href="https://www.linkedin.com/in/rajkirant/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LinkedInIcon
              sx={{
                fontSize: 30,
                color: "#e0e7ff",
                marginTop: 14,
              }}
            />
          </a>

          <div
            style={{
              marginTop: 28,
              fontSize: 13,
              color: "#c7d2fe",
            }}
          >
            © {new Date().getFullYear()} Torensa. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
