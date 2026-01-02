import React from "react";
import { Routes, Route, NavLink, Link } from "react-router-dom";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { useAuth } from "./auth";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useTheme } from "@mui/material/styles";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkedInIcon from "@mui/icons-material/LinkedIn";

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
  letterSpacing: 0.5,
};

const navLinkBase: React.CSSProperties = {
  textDecoration: "none",
  fontWeight: 500,
  color: "#e5e7eb",
};

const sectionBase: React.CSSProperties = {
  padding: "80px 24px",
  maxWidth: 1100,
  margin: "0 auto",
};

const gradientText: React.CSSProperties = {
  background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

/* ===================== APP ===================== */

export default function App({ themeName, setThemeName }: AppProps) {
  const { user, loading, setUser } = useAuth();
  const theme = useTheme();

  /* ---------- THEME-DRIVEN STYLES ---------- */

  const headerStyle: React.CSSProperties = {
    background: `linear-gradient(
      135deg,
      ${theme.palette.info.main} 0%,
      ${theme.palette.primary.main} 50%,
      ${theme.palette.secondary.main} 100%
    )`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "24px 32px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
  };

  const sectionStyle: React.CSSProperties = {
    ...sectionBase,
    color: theme.palette.text.primary,
  };

  const surfaceStyle: React.CSSProperties = {
    backgroundColor: theme.palette.background.paper,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.palette.background.paper,
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
  };

  const secondaryText: React.CSSProperties = {
    color: theme.palette.text.secondary,
  };

  const footerStyle: React.CSSProperties = {
    marginTop: 120,
    padding: "96px 24px 48px",
    backgroundColor: theme.palette.background.default,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  };

  const footerCard: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
    padding: "56px 32px",
    borderRadius: 28,
    backgroundColor: theme.palette.background.paper,
    border: "1px solid rgba(255,255,255,0.1)",
    textAlign: "center",
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
                {/* Logged-in user */}
                <span
                  style={{
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: 14,
                    opacity: 0.95,
                  }}
                >
                  Hi, {user.username}
                </span>

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
                <header style={{ padding: "120px 24px", textAlign: "center" }}>
                  <h1 style={{ fontSize: 56 }}>
                    <span style={gradientText}>Torensa</span>
                  </h1>

                  <p style={{ fontSize: 22, ...secondaryText }}>
                    Freelance Software Developer
                  </p>

                  <Stack direction="row" spacing={2} justifyContent="center">
                    <Button
                      variant="contained"
                      size="large"
                      endIcon={<ArrowForwardIcon />}
                      href="#/contact"
                    >
                      Start a Project
                    </Button>
                  </Stack>
                </header>

                {/* SERVICES */}
                <section style={sectionStyle}>
                  <h2 style={{ textAlign: "center", marginBottom: 48 }}>
                    Services
                  </h2>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 32,
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
                <section style={{ ...sectionStyle, ...surfaceStyle }}>
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

          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </main>

      {/* ================= FOOTER ================= */}
      <footer style={footerStyle}>
        <div style={footerCard}>
          <strong>Torensa</strong>

          <p style={{ marginTop: 12, ...secondaryText }}>
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
                fontSize: 32,
                color: theme.palette.primary.main,
                marginTop: 16,
              }}
            />
          </a>

          <div
            style={{
              marginTop: 32,
              fontSize: 13,
              color: theme.palette.text.secondary,
            }}
          >
            © {new Date().getFullYear()} Torensa. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
