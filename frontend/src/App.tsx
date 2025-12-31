import React from "react";
import { Routes, Route, NavLink, Link } from "react-router-dom";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import { useAuth } from "./auth";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkedInIcon from "@mui/icons-material/LinkedIn";

/* -------------------- Reusable style objects -------------------- */
const headerStyle: React.CSSProperties = {
  backgroundColor: "#0b0b0b",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "24px 32px",
  marginBottom: 48,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const brandLinkStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#ffffff",
  textDecoration: "none",
  letterSpacing: 0.3,
};

const navLinkBase: React.CSSProperties = {
  textDecoration: "none",
  fontWeight: 500,
  color: "#d1d5db",
};

/* Footer uses a different, complementary dark-blue/indigo tone so header and footer
   are visually distinct while keeping a cohesive dark theme. */
const footerStyle: React.CSSProperties = {
  backgroundColor: "#0f172a", // different from header (#0b0b0b)
  marginTop: 96,
  padding: "48px 24px",
  borderTop: "1px solid rgba(255,255,255,0.04)",
};

const footerInnerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
  textAlign: "center",
};

export default function App() {
  const { user, loading, setUser } = useAuth();

  return (
    <div className="container">
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        style={{
          position: "absolute",
          left: -9999,
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
        onFocus={(e) => {
          const el = e.currentTarget;
          el.style.left = "8px";
          el.style.top = "8px";
          el.style.width = "auto";
          el.style.height = "auto";
          el.style.padding = "8px 12px";
          el.style.background = "#fff";
          el.style.color = "#000";
          el.style.zIndex = "9999";
        }}
        onBlur={(e) => {
          const el = e.currentTarget;
          el.style.left = "-9999px";
          el.style.top = "auto";
          el.style.width = "1px";
          el.style.height = "1px";
          el.style.padding = "";
          el.style.background = "";
          el.style.color = "";
          el.style.zIndex = "";
        }}
      >
        Skip to content
      </a>

      {/* ================= HEADER ================= */}
      <header style={headerStyle}>
        {/* BRAND */}
        <Link to="/" style={brandLinkStyle} aria-label="Torensa home">
          Torensa
        </Link>

        {/* NAV */}
        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) =>
              isActive
                ? { ...navLinkBase, color: "#fff", textDecoration: "underline" }
                : navLinkBase
            }
            aria-current={({ isActive }) => (isActive ? "page" : undefined)}
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
            aria-current={({ isActive }) => (isActive ? "page" : undefined)}
          >
            Contact
          </NavLink>

          {!loading &&
            (user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, color: "#d1d5db" }}>
                  Hi, <strong>{user.username}</strong>
                </span>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ color: "#fff", borderColor: "#4b5563" }}
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
              </div>
            ) : (
              <Link
                to="/login"
                style={{
                  textDecoration: "none",
                  fontWeight: 500,
                  color: "#fff",
                }}
              >
                Login
              </Link>
            ))}
        </nav>
      </header>

      {/* ================= MAIN ================= */}
      <main id="main-content" tabIndex={-1}>
        <Routes>
          {/* HOME */}
          <Route
            path="/"
            element={
              <>
                {/* HERO */}
                <header className="hero" aria-labelledby="hero-title">
                  <h1 id="hero-title">Torensa</h1>
                  <p className="subtitle">Freelance Software Developer</p>
                  <p className="tagline">
                    Building scalable, secure, and maintainable web
                    applications.
                  </p>

                  <Stack
                    direction="row"
                    spacing={2}
                    justifyContent="center"
                    sx={{ mt: 4 }}
                  >
                    <Button
                      variant="contained"
                      size="large"
                      endIcon={<ArrowForwardIcon />}
                      href="#/contact"
                      sx={{
                        px: 4,
                        py: 1.5,
                        fontSize: "1rem",
                        fontWeight: 600,
                        borderRadius: 3,
                        textTransform: "none",
                        background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                        boxShadow: "0 10px 25px rgba(124, 58, 237, 0.35)",
                        "&:hover": {
                          background:
                            "linear-gradient(135deg, #1e40af, #6d28d9)",
                          boxShadow: "0 12px 28px rgba(124, 58, 237, 0.5)",
                        },
                      }}
                    >
                      Contact Me
                    </Button>
                  </Stack>
                </header>

                {/* SERVICES */}
                <section>
                  <h2>Services</h2>
                  <div className="cards">
                    <div className="card">
                      <h3>Web Development</h3>
                      <p>
                        Responsive, high-performance web applications using
                        React and modern frontend tooling.
                      </p>
                    </div>
                    <div className="card">
                      <h3>Backend APIs</h3>
                      <p>
                        Secure and scalable APIs using Spring Boot, Java, and
                        REST or GraphQL.
                      </p>
                    </div>
                    <div className="card">
                      <h3>Deployment & DevOps</h3>
                      <p>
                        Dockerised applications, CI/CD pipelines, and cloud
                        deployments.
                      </p>
                    </div>
                  </div>
                </section>

                {/* SKILLS */}
                <section>
                  <h2>Skills</h2>
                  <ul className="skills">
                    <li>React</li>
                    <li>TypeScript</li>
                    <li>Vite</li>
                    <li>Java</li>
                    <li>Spring Boot</li>
                    <li>Docker</li>
                  </ul>
                </section>
              </>
            }
          />

          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>

      {/* ================= FOOTER ================= */}
      <footer style={footerStyle}>
        <div style={footerInnerStyle}>
          <strong style={{ fontSize: 18, color: "#ffffff" }}>Torensa</strong>

          <p style={{ maxWidth: 520, color: "#9ca3af", fontSize: 15 }}>
            Freelance software developer specialising in scalable, secure, and
            maintainable web applications.
          </p>

          <a
            href="https://www.linkedin.com/in/rajkirant/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn profile"
          >
            <LinkedInIcon
              sx={{
                fontSize: 30,
                color: "#0A66C2",
                "&:hover": { color: "#004182", transform: "scale(1.1)" },
                transition: "all 0.2s ease",
              }}
            />
          </a>

          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 24 }}>
            © {new Date().getFullYear()} Torensa. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
